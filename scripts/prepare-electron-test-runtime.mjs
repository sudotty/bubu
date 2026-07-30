import { statSync } from "node:fs";
import electronExecutable from "electron";

const executable = statSync(electronExecutable);
if (!executable.isFile() || executable.size === 0) {
  throw new Error("Electron test runtime is unavailable");
}
console.log(`Electron test runtime prepared: ${electronExecutable}`);
