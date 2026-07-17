import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

export function preparePrivateDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
}

export function atomicPrivateWrite(path: string, value: string | Buffer): void {
  const temporaryPath = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(temporaryPath, value, { flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, path);
    chmodSync(path, 0o600);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
