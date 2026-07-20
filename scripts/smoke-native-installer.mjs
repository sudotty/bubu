import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { assertDistinctUpgrade, assertNativeInstaller, lifecycleSteps } from "./native-installer-policy.mjs";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function findFile(root, name) {
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return path;
    if (entry.isDirectory()) {
      const nested = findFile(path, name);
      if (nested) return nested;
    }
  }
  return undefined;
}

function waitForFile(root, name, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const file = findFile(root, name);
    if (file) return file;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  } while (Date.now() < deadline);
  return undefined;
}

const artifact = resolve(argument("--artifact") ?? "");
const previousArtifactValue = argument("--previous-artifact");
const previousArtifact = previousArtifactValue ? resolve(previousArtifactValue) : undefined;
const reportPath = argument("--report");
const requireSignature = process.argv.includes("--require-signature");
assertNativeInstaller(process.platform, artifact);
if (!existsSync(artifact)) throw new Error(`Installer artifact is missing: ${artifact}`);
if (previousArtifact) {
  assertNativeInstaller(process.platform, previousArtifact);
  if (!existsSync(previousArtifact)) throw new Error(`Previous installer artifact is missing: ${previousArtifact}`);
  const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
  assertDistinctUpgrade(artifact, previousArtifact, digest(artifact), digest(previousArtifact));
}

const workspace = mkdtempSync(join(tmpdir(), "bubu-installer-smoke-"));
const passed = [];
const environment = { ...process.env };

function smokeExecutable(executable) {
  run(process.execPath, [resolve("scripts", "smoke-packaged-desktop.mjs"), `--executable=${executable}`], { env: environment });
  passed.push("launch-import-task-backup-restore");
}

function installMac(dmg, destination) {
  const mount = join(workspace, `mount-${basename(dmg, ".dmg")}`);
  mkdirSync(mount, { recursive: true });
  run("hdiutil", ["attach", dmg, "-readonly", "-nobrowse", "-mountpoint", mount]);
  try {
    const source = join(mount, "BuBu.app");
    if (!existsSync(source)) throw new Error(`DMG does not contain BuBu.app: ${dmg}`);
    rmSync(destination, { recursive: true, force: true });
    run("ditto", [source, destination]);
  } finally {
    run("hdiutil", ["detach", mount]);
  }
}

function verifyMacSignature(appPath, dmg) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  run("spctl", ["--assess", "--type", "execute", "--verbose=2", appPath]);
  run("xcrun", ["stapler", "validate", dmg]);
  passed.push("signature-and-notarization");
}

function verifyWindowsSignature(path) {
  const escaped = path.replaceAll("'", "''");
  const script = `(Get-AuthenticodeSignature -FilePath '${escaped}').Status`;
  if (!run("powershell", ["-NoProfile", "-Command", script]).includes("Valid")) throw new Error(`Windows Authenticode signature is not valid: ${path}`);
}

function windowsInstallRoot() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error("Windows installer smoke requires LOCALAPPDATA");
  return join(localAppData, "BuBu");
}

function installWindows(setup, installRoot) {
  run(setup, ["--silent"], { env: environment });
  const executable = waitForFile(installRoot, "bubu.exe");
  if (!executable) throw new Error(`Squirrel install completed without bubu.exe under ${installRoot}`);
  return executable;
}

function uninstallWindows(installRoot) {
  const updater = findFile(installRoot, "Update.exe");
  if (!updater) throw new Error("Squirrel install completed without Update.exe");
  run(updater, ["--uninstall", "-s"], { env: environment });
}

let installedWindowsRoot;
try {
  if (process.platform === "darwin") {
    const installedApp = join(workspace, "Applications", "BuBu.app");
    if (previousArtifact) {
      installMac(previousArtifact, installedApp);
      smokeExecutable(join(installedApp, "Contents", "MacOS", "bubu"));
      passed.push("previous-version-install");
    }
    installMac(artifact, installedApp);
    passed.push("install");
    smokeExecutable(join(installedApp, "Contents", "MacOS", "bubu"));
    if (previousArtifact) passed.push("upgrade");
    if (requireSignature) verifyMacSignature(installedApp, artifact);
    rmSync(installedApp, { recursive: true, force: true });
    if (existsSync(installedApp)) throw new Error("macOS temporary uninstall failed");
    passed.push("uninstall");
  } else {
    const installRoot = windowsInstallRoot();
    if (existsSync(installRoot)) {
      throw new Error(`Refusing to replace an existing BuBu installation during smoke testing: ${installRoot}`);
    }
    installedWindowsRoot = installRoot;
    if (previousArtifact) {
      smokeExecutable(installWindows(previousArtifact, installRoot));
      passed.push("previous-version-install");
    }
    const executable = installWindows(artifact, installRoot);
    passed.push("install");
    smokeExecutable(executable);
    if (previousArtifact) passed.push("upgrade");
    if (requireSignature) {
      verifyWindowsSignature(artifact);
      verifyWindowsSignature(executable);
      passed.push("installer-and-application-signatures");
    }
    uninstallWindows(installRoot);
    installedWindowsRoot = undefined;
    passed.push("uninstall");
  }

  const report = {
    schemaVersion: 1,
    platform: process.platform,
    arch: process.arch,
    artifact: basename(artifact),
    requiredSteps: lifecycleSteps(Boolean(previousArtifact)),
    passed,
    upgrade: previousArtifact ? "passed" : "skipped-no-previous-artifact",
    signature: requireSignature ? "passed" : "not-requested",
  };
  if (reportPath) writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`Native installer smoke passed: ${JSON.stringify(report)}`);
} finally {
  if (installedWindowsRoot && existsSync(installedWindowsRoot)) {
    try {
      uninstallWindows(installedWindowsRoot);
    } catch (error) {
      console.error(`Best-effort Windows smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  rmSync(workspace, { recursive: true, force: true });
}
