import { resolve } from "node:path";

export function dataCoreBinaryName(targetPlatform = process.platform) {
  return targetPlatform === "win32" ? "bubu-data-core.exe" : "bubu-data-core";
}

export function dataCoreBinaryPath(targetPlatform = process.platform) {
  return resolve("services", "data-core", "bin", dataCoreBinaryName(targetPlatform));
}

export function goTarget(targetPlatform = process.platform, targetArch = process.arch) {
  const goos = targetPlatform === "win32" ? "windows" : targetPlatform === "darwin" ? "darwin" : targetPlatform === "linux" ? "linux" : undefined;
  const goarch = targetArch === "x64" ? "amd64" : targetArch === "arm64" ? "arm64" : undefined;
  if (!goos || !goarch) throw new Error(`Unsupported native target: ${targetPlatform}-${targetArch}`);
  return { goos, goarch };
}
