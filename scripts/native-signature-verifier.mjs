import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

export function verifyNativeInstallerSignature(platform, artifact) {
  if (platform === "darwin") {
    run("codesign", ["--verify", "--strict", "--verbose=2", artifact]);
    run("spctl", ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=2", artifact]);
    run("xcrun", ["stapler", "validate", artifact]);
    return;
  }
  if (platform === "win32") {
    const escaped = artifact.replaceAll("'", "''");
    const output = run("powershell", ["-NoProfile", "-Command", `(Get-AuthenticodeSignature -FilePath '${escaped}').Status`]);
    if (!output.split(/\r?\n/u).some((line) => line.trim() === "Valid")) {
      throw new Error(`Windows Authenticode signature is not valid: ${artifact}`);
    }
    return;
  }
  throw new Error(`Native signature verification is unsupported on ${platform}`);
}
