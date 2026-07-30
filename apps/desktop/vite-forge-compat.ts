import type { Plugin, ResolvedConfig } from "vite";

type BundlerOutput = {
  codeSplitting?: boolean | object;
  inlineDynamicImports?: boolean;
};

export function migrateForgePreloadOutput(
  output: BundlerOutput | BundlerOutput[] | undefined,
): void {
  const outputs = Array.isArray(output) ? output : output ? [output] : [];

  for (const item of outputs) {
    if (item.inlineDynamicImports === undefined) {
      continue;
    }

    item.codeSplitting ??= !item.inlineDynamicImports;
    delete item.inlineDynamicImports;
  }
}

export function forgePreloadVite8Compat(): Plugin {
  return {
    name: "bubu:forge-preload-vite-8-compat",
    enforce: "post",
    configResolved(config: ResolvedConfig) {
      migrateForgePreloadOutput(config.build.rolldownOptions?.output);
    },
  };
}
