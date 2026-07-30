export const onboardingCompletionKey = "bubu:onboarding-checklist:v1";
export const onboardingResetEvent = "bubu:onboarding-reset";

export function resetOnboarding(storage: Storage, target: Window): void {
  storage.removeItem(onboardingCompletionKey);
  target.dispatchEvent(new Event(onboardingResetEvent));
}
