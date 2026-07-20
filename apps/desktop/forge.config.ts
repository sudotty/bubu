import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { resolve } from "node:path";

const dataCoreBinary = process.platform === "win32" ? "bubu-data-core.exe" : "bubu-data-core";

const macSignIdentity = process.env.BUBU_MAC_SIGN_IDENTITY?.trim();
const appleId = process.env.BUBU_APPLE_ID?.trim();
const appleIdPassword = process.env.BUBU_APPLE_APP_PASSWORD?.trim();
const appleTeamId = process.env.BUBU_APPLE_TEAM_ID?.trim();

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "bubu",
    electronZipDir: resolve("..", "..", ".cache", "electron"),
    ...(macSignIdentity ? { osxSign: { identity: macSignIdentity, optionsForFile: () => ({ hardenedRuntime: true, entitlements: "resources/entitlements.mac.plist" }) } } : {}),
    ...(appleId && appleIdPassword && appleTeamId ? { osxNotarize: { appleId, appleIdPassword, teamId: appleTeamId } } : {}),
    extraResource: [
      "../../services/ai-runtime/dist",
      `../../services/data-core/bin/${dataCoreBinary}`,
    ],
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ["darwin", "win32", "linux"])],
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
