export interface OneUseAuthorizationStore<T> {
  issue(value: T): { readonly token: string; readonly expiresAt: number };
  issueWithGrant(createValue: (grant: { readonly token: string; readonly expiresAt: number }) => T): { readonly token: string; readonly expiresAt: number };
  consume(token: string): T;
  revoke(token: string): void;
}

interface Options {
  readonly now: () => number;
  readonly newToken: () => string;
  readonly lifetimeMilliseconds: number;
  readonly maximumSessions: number;
  readonly allocationError: string;
  readonly consumeError: string;
}

/** I/O-free lifecycle kernel shared by all exact, one-use desktop authorizations. */
export function createOneUseAuthorizationStore<T>(options: Options): OneUseAuthorizationStore<T> {
  if (!Number.isSafeInteger(options.lifetimeMilliseconds) || options.lifetimeMilliseconds <= 0) throw new Error("Authorization lifetime must be a positive integer");
  if (!Number.isSafeInteger(options.maximumSessions) || options.maximumSessions <= 0) throw new Error("Authorization capacity must be a positive integer");
  const pending = new Map<string, { readonly value: T; readonly expiresAt: number }>();
  const removeExpired = (currentTime: number) => {
    for (const [token, session] of pending) if (session.expiresAt <= currentTime) pending.delete(token);
  };
  const issueWithGrant = (createValue: (grant: { readonly token: string; readonly expiresAt: number }) => T) => {
      const currentTime = options.now();
      removeExpired(currentTime);
      while (pending.size >= options.maximumSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const token = options.newToken();
      if (pending.has(token)) throw new Error(options.allocationError);
      const expiresAt = currentTime + options.lifetimeMilliseconds;
      const grant = { token, expiresAt };
      pending.set(token, { value: createValue(grant), expiresAt });
      return grant;
  };
  return {
    issue: (value) => issueWithGrant(() => value),
    issueWithGrant,
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt <= options.now()) throw new Error(options.consumeError);
      return session.value;
    },
    revoke(token) { pending.delete(token); },
  };
}
