import { app } from "electron";
import { join, resolve } from "node:path";

export function dataCoreExecutableName(targetPlatform: NodeJS.Platform = process.platform): string {
  return targetPlatform === "win32" ? "bubu-data-core.exe" : "bubu-data-core";
}

export function resolveRuntimePaths(input: {
  readonly packaged: boolean;
  readonly resourcesPath: string;
  readonly appPath: string;
  readonly platform?: NodeJS.Platform;
}): { readonly aiRuntime: string; readonly dataCore: string } {
  const binary = dataCoreExecutableName(input.platform);
  if (input.packaged) {
    return {
      aiRuntime: join(input.resourcesPath, "dist", "index.cjs"),
      dataCore: join(input.resourcesPath, binary),
    };
  }
  const repositoryRoot = resolve(input.appPath, "..", "..");
  return {
    aiRuntime: join(repositoryRoot, "services", "ai-runtime", "dist", "index.cjs"),
    dataCore: join(repositoryRoot, "services", "data-core", "bin", binary),
  };
}

export function runtimePaths(): { readonly aiRuntime: string; readonly dataCore: string } {
  return resolveRuntimePaths({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
}
