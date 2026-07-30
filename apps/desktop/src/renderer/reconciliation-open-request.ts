export function shouldOpenReconciliation(
  request: number,
  lastHandledRequest: number,
  hasGroup: boolean,
): boolean {
  return request > 0 && request !== lastHandledRequest && hasGroup;
}
