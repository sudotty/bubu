const [majorText, minorText] = process.versions.node.split(".");
const major = Number(majorText);
const minor = Number(minorText);

if (!Number.isInteger(major) || !Number.isInteger(minor)) {
  console.error(`Unable to parse Node version: ${process.versions.node}`);
  process.exit(1);
}

if (major < 22 || (major === 22 && minor < 18) || major >= 26) {
  console.error(
    `Unsupported Node ${process.versions.node}. Use Node 22.18+ or Node 24 LTS; Node 26 prematurely exits Electron Packager 18.4.4 during async extraction.`,
  );
  process.exit(1);
}

console.log(`Toolchain verification passed (Node ${process.versions.node}).`);
