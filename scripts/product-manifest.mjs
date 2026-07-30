import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const capabilityKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const implementationStatuses = new Set(["implemented", "planned"]);
const productStatuses = new Set(["available-local", "available-optional", "external-evidence-required", "future"]);
const releaseStages = new Set(["internal-alpha", "private-beta", "public-preview", "general-availability"]);
const releaseChannels = new Set(["preview", "stable"]);

function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be a mapping`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function stringRecord(value, label, allowedStatuses, maximum) {
  const source = record(value, label);
  const entries = Object.entries(source);
  if (entries.length === 0 || entries.length > maximum) throw new Error(`${label} must contain 1-${maximum} entries`);
  const result = {};
  for (const [key, status] of entries) {
    if (!capabilityKey.test(key)) throw new Error(`${label}.${key} has an invalid key`);
    if (typeof status !== "string" || !allowedStatuses.has(status)) throw new Error(`${label}.${key} has an invalid status`);
    result[key] = status;
  }
  return result;
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${label} must be a non-empty string list`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates`);
  return value;
}

export function parseProductManifest(source) {
  const document = parseDocument(source, { uniqueKeys: true, merge: false, prettyErrors: true });
  if (document.errors.length > 0) throw new Error(`PRODUCT_MANIFEST.yaml is invalid: ${document.errors.map(({ message }) => message).join("; ")}`);
  const root = record(document.toJS({ maxAliasCount: 0 }), "manifest");
  const expectedRootKeys = ["schemaVersion", "product", "release", "architecture", "privacy", "productCapabilities", "capabilities", "releaseGates"];
  const rootKeys = Object.keys(root).sort();
  if (rootKeys.length !== expectedRootKeys.length || rootKeys.some((key, index) => key !== expectedRootKeys.toSorted()[index])) {
    throw new Error("manifest contains missing or unknown top-level fields");
  }
  if (root.schemaVersion !== 1) throw new Error("manifest.schemaVersion must be 1");
  const product = record(root.product, "manifest.product");
  const release = record(root.release, "manifest.release");
  const architecture = record(root.architecture, "manifest.architecture");
  const privacy = record(root.privacy, "manifest.privacy");
  const releaseStage = text(product.releaseStage, "manifest.product.releaseStage");
  const channel = text(release.channel, "manifest.release.channel");
  if (!releaseStages.has(releaseStage)) throw new Error("manifest.product.releaseStage is invalid");
  if (!releaseChannels.has(channel)) throw new Error("manifest.release.channel is invalid");
  if ((releaseStage === "general-availability") !== (channel === "stable")) {
    throw new Error("only general availability may use the stable release channel");
  }
  if (privacy.remoteRawRowsByDefault !== false) throw new Error("manifest.privacy.remoteRawRowsByDefault must remain false");
  const productCapabilities = stringRecord(root.productCapabilities, "manifest.productCapabilities", productStatuses, 20);
  const capabilities = stringRecord(root.capabilities, "manifest.capabilities", implementationStatuses, 500);
  const releaseGates = stringList(root.releaseGates, "manifest.releaseGates");
  for (const key of ["desktop", "renderer", "aiRuntime", "dataCore", "localDatabase"]) text(architecture[key], `manifest.architecture.${key}`);
  if (productCapabilities["signed-public-distribution"] === "external-evidence-required" && capabilities["signed-installers"] !== "planned") {
    throw new Error("signed public distribution must remain planned until external evidence exists");
  }
  if (productCapabilities["design-partner-validation"] === "external-evidence-required" && capabilities["consented-design-partner-pilot-evidence"] !== "planned") {
    throw new Error("design-partner validation must remain planned until external evidence exists");
  }
  return Object.freeze({ schemaVersion: 1, product, release, architecture, privacy, productCapabilities, capabilities, releaseGates });
}

export function loadProductManifest(rootDirectory = resolve(import.meta.dirname, "..")) {
  const directory = rootDirectory instanceof URL ? fileURLToPath(rootDirectory) : rootDirectory;
  return parseProductManifest(readFileSync(resolve(directory, "PRODUCT_MANIFEST.yaml"), "utf8"));
}

export function requireCapability(manifest, name, expected, failures, label = "product manifest") {
  const actual = manifest.capabilities[name];
  if (actual !== expected) failures.push(`${label} expected ${name}: ${expected}, found ${actual ?? "missing"}`);
}

export function requireProductCapability(manifest, name, expected, failures, label = "product capability") {
  const actual = manifest.productCapabilities[name];
  if (actual !== expected) failures.push(`${label} expected ${name}: ${expected}, found ${actual ?? "missing"}`);
}

export function requireManifestFacts(manifest, expectations, failures, label = "product manifest") {
  const sections = [manifest.product, manifest.release, manifest.architecture, manifest.privacy, manifest.productCapabilities, manifest.capabilities];
  for (const expectation of expectations) {
    const separator = expectation.lastIndexOf(": ");
    if (separator < 1) throw new Error(`manifest expectation must use "key: value": ${expectation}`);
    const key = expectation.slice(0, separator);
    const expected = expectation.slice(separator + 2);
    const matches = sections.flatMap((section) => Object.hasOwn(section, key) ? [String(section[key])] : []);
    if (matches.length === 0) failures.push(`${label} is missing ${key}`);
    else if (matches.length > 1) failures.push(`${label} fact is ambiguous: ${key}`);
    else if (matches[0] !== expected) failures.push(`${label} expected ${key}: ${expected}, found ${matches[0]}`);
  }
}
