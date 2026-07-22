import { pathToFileURL } from "node:url";

const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function previewVersion(tag) {
  if (typeof tag !== "string" || !tag.startsWith("preview-v")) {
    throw new Error(`Expected preview-v<SemVer> tag; received ${String(tag)}`);
  }

  const version = tag.slice("preview-v".length);
  const match = semanticVersion.exec(version);
  if (!match) throw new Error(`Expected preview-v<SemVer> tag; received ${tag}`);

  const prerelease = match[4];
  if (prerelease?.split(".").some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0"))) {
    throw new Error(`Preview tag contains a numeric prerelease identifier with a leading zero: ${tag}`);
  }

  return version;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const tag = process.argv[2] ?? process.env.BUBU_PREVIEW_TAG;
  console.log(`Validated unsigned preview ${previewVersion(tag)}.`);
}
