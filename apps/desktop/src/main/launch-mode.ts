import { isAbsolute, join } from "node:path";

export type LaunchMode =
  | { readonly kind: "desktop"; readonly dataDirectory: string }
  | {
      readonly kind: "smoke";
      readonly dataDirectory: string;
      readonly sourcePath: string;
      readonly secondSourcePath: string;
      readonly screenshotDirectory?: string;
    };

export function parseLaunchMode(
  arguments_: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  userDataDirectory: string,
): LaunchMode {
  if (!arguments_.includes("--bubu-smoke-test")) {
    return { kind: "desktop", dataDirectory: join(userDataDirectory, "data") };
  }

  const dataDirectory = environment.BUBU_SMOKE_DATA_DIR?.trim();
  const sourcePath = environment.BUBU_SMOKE_SOURCE?.trim();
  const secondSourcePath = environment.BUBU_SMOKE_SECOND_SOURCE?.trim();
  if (!dataDirectory || !sourcePath || !secondSourcePath) {
    throw new Error("Packaged smoke requires isolated data and two source paths");
  }
  if (!isAbsolute(dataDirectory) || !isAbsolute(sourcePath) || !isAbsolute(secondSourcePath)) {
    throw new Error("Packaged smoke paths must be absolute");
  }
  const screenshotDirectory = environment.BUBU_SMOKE_SCREENSHOT_DIR?.trim();
  if (screenshotDirectory && !isAbsolute(screenshotDirectory)) {
    throw new Error("Packaged smoke screenshot path must be absolute");
  }
  return {
    kind: "smoke",
    dataDirectory,
    sourcePath,
    secondSourcePath,
    ...(screenshotDirectory ? { screenshotDirectory } : {}),
  };
}
