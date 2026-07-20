import type { ProductMetricInput } from "../shared/product-api.js";

export function recordProductMetric(value: ProductMetricInput): void {
  void window.bubu.metrics.record(value).catch(() => {
    // Metrics are local diagnostics and must never block the product journey.
  });
}
