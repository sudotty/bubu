export interface DeliveryRetryDecision { readonly status: "retry-wait" | "failed"; readonly nextAttemptAt: string | null; readonly errorCode: string }

export function decideExternalDeliveryFailure(input: { readonly attempts: number; readonly now: string; readonly errorCode: string }): DeliveryRetryDecision {
  if (!Number.isInteger(input.attempts) || input.attempts < 1 || input.attempts > 3 || !/^[A-Z][A-Z0-9_]{0,63}$/u.test(input.errorCode) || !Number.isFinite(Date.parse(input.now))) throw new Error("External delivery failure input is invalid");
  if (input.attempts >= 3) return { status: "failed", nextAttemptAt: null, errorCode: input.errorCode };
  const backoffMilliseconds = input.attempts === 1 ? 30_000 : 120_000;
  return { status: "retry-wait", nextAttemptAt: new Date(Date.parse(input.now) + backoffMilliseconds).toISOString(), errorCode: input.errorCode };
}
