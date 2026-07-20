import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { resolve } from "node:path";
import { resolveMacSigning, resolveWindowsSigning } from "./release-signing.js";

const dataCoreBinary = process.platform === "win32" ? "bubu-data-core.exe" : "bubu-data-core";
const appIcon = resolve("resources", "icons", process.platform === "win32" ? "bubu.ico" : "bubu.icns");

const macSigning = resolveMacSigning();
const windowsSign = resolveWindowsSigning();

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.sudotty.bubu",
    appCategoryType: "public.app-category.productivity",
    executableName: "bubu",
    icon: appIcon,
    name: "BuBu",
    win32metadata: {
      CompanyName: "sudotty",
      FileDescription: "BuBu local-first AI data workspace",
      InternalName: "BuBu",
      OriginalFilename: "bubu.exe",
      ProductName: "BuBu",
    },
    electronZipDir: resolve("..", "..", ".cache", "electron"),
    ...macSigning,
    ...(windowsSign ? { windowsSign } : {}),
    extraResource: [
      "../../services/ai-runtime/dist",
      `../../services/data-core/bin/${dataCoreBinary}`,
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({ name: "BuBu", format: "ULFO" }, ["darwin"]),
    new MakerZIP({}, ["darwin"]),
    new MakerSquirrel({
      name: "BuBu",
      authors: "sudotty",
      description: "Local-first AI data workspace",
      exe: "bubu.exe",
      setupExe: "BuBu-Setup.exe",
      setupIcon: resolve("resources", "icons", "bubu.ico"),
      noMsi: true,
      // MakerSquirrel currently exposes the CJS copy of the same hash enum used by Packager's ESM types.
      ...(windowsSign ? { windowsSign: windowsSign as never } : {}),
    }, ["win32"]),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
