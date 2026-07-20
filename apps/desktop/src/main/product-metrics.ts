import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseProductMetricInput, type ProductMetricInput } from "@bubu/contracts";

export function createProductMetricsStore(directory: string, now: () => Date = () => new Date()) {
  return {
    async record(value: unknown): Promise<void> {
      const input: ProductMetricInput = parseProductMetricInput(value);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await appendFile(join(directory, "events.ndjson"), `${JSON.stringify({ schemaVersion: 1, occurredAt: now().toISOString(), ...input })}\n`, { encoding: "utf8", mode: 0o600 });
    },
  };
}
