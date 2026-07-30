import { describe, expect, it } from "vitest";
import { recommendFirstTask, type DatasetStructureSnapshot } from "./onboarding.js";

describe("first-task recommendation", () => {
  it("recommends import for an empty workspace", () => expect(recommendFirstTask([]).kind).toBe("import"));
  const snapshot = (id: string, sourceName: string, columns: DatasetStructureSnapshot["columns"], reconciliationContext = false): DatasetStructureSnapshot => ({ id, sourceName, columns, reconciliationContext });
  it("recommends cleaning a single structure with missing values", () => expect(recommendFirstTask([snapshot("a", "sales.csv", [{ name: "amount", type: "real", nullCount: 2 }])]).kind).toBe("clean"));
  it("recommends merge only when identical structures have periodic evidence", () => expect(recommendFirstTask([
    snapshot("a", "orders-2026-06.csv", [{ name: "amount", type: "real", nullCount: 0 }]),
    snapshot("b", "orders-2026-07.csv", [{ name: "amount", type: "real", nullCount: 0 }]),
  ]).kind).toBe("merge"));
  it("does not infer merge from matching columns alone", () => expect(recommendFirstTask([
    snapshot("a", "customers.csv", [{ name: "amount", type: "real", nullCount: 0 }]),
    snapshot("b", "targets.csv", [{ name: "amount", type: "real", nullCount: 0 }]),
  ]).kind).toBe("create-topic"));
  it("does not infer merge merely because different tables share a recurring topic", () => expect(recommendFirstTask([
    snapshot("a", "synthetic-sales.csv", [{ name: "amount", type: "real", nullCount: 0 }], true),
    snapshot("b", "synthetic-targets.csv", [{ name: "amount", type: "real", nullCount: 0 }], true),
  ]).kind).toBe("reconcile"));
  it("asks for a topic before reconciliation when no context exists", () => expect(recommendFirstTask([
    snapshot("a", "orders.csv", [{ name: "order_id", type: "text", nullCount: 0 }, { name: "amount", type: "real", nullCount: 0 }]),
    snapshot("b", "payments.csv", [{ name: "order_id", type: "text", nullCount: 0 }, { name: "status", type: "text", nullCount: 0 }]),
  ]).kind).toBe("create-topic"));
  it("recommends reconciliation only with an existing topic", () => expect(recommendFirstTask([
    snapshot("a", "orders.csv", [{ name: "order_id", type: "text", nullCount: 0 }, { name: "amount", type: "real", nullCount: 0 }], true),
    snapshot("b", "payments.csv", [{ name: "order_id", type: "text", nullCount: 0 }, { name: "status", type: "text", nullCount: 0 }], true),
  ]).kind).toBe("reconcile"));
});
