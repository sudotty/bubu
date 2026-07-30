import { readEvidence, validatePilotEvidence, validatePublicBetaEvidence } from "./external-evidence-policy.mjs";

const requirePublicBeta = process.argv.includes("--require-public-beta");
const requirePilot = process.argv.includes("--require-pilot");
const failures = [];
if (requirePublicBeta) {
  const path = process.env.BUBU_PUBLIC_BETA_EVIDENCE_PATH;
  if (!path) failures.push("BUBU_PUBLIC_BETA_EVIDENCE_PATH is required");
  else try { failures.push(...validatePublicBetaEvidence(readEvidence(path))); } catch (error) { failures.push(`public-beta evidence cannot be read: ${error instanceof Error ? error.message : String(error)}`); }
}
if (requirePilot) {
  const path = process.env.BUBU_PILOT_EVIDENCE_PATH;
  if (!path) failures.push("BUBU_PILOT_EVIDENCE_PATH is required");
  else try { failures.push(...validatePilotEvidence(readEvidence(path))); } catch (error) { failures.push(`pilot evidence cannot be read: ${error instanceof Error ? error.message : String(error)}`); }
}
if (failures.length) {
  console.error(`External evidence gate blocked:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(requirePublicBeta || requirePilot ? "External evidence satisfies the requested gate." : "External evidence schemas verified; no external completion claim was requested.");
