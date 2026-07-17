const replacementSessionLifetimeMs = 10 * 60 * 1_000;
const maximumReplacementSessions = 20;

interface ReplacementSessionStoreOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

interface PendingReplacement {
  readonly datasetId: string;
  readonly sourcePath: string;
  readonly expiresAt: number;
}

export interface ReplacementSessionStore {
  issue(datasetId: string, sourcePath: string): string;
  consume(token: string): { readonly datasetId: string; readonly sourcePath: string };
}

export function createReplacementSessionStore(
  options: ReplacementSessionStoreOptions,
): ReplacementSessionStore {
  const pending = new Map<string, PendingReplacement>();

  const removeExpired = () => {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt < now) pending.delete(token);
    }
  };

  return {
    issue(datasetId, sourcePath) {
      removeExpired();
      while (pending.size >= maximumReplacementSessions) {
        const oldestToken = pending.keys().next().value as string | undefined;
        if (oldestToken === undefined) break;
        pending.delete(oldestToken);
      }
      const token = options.newToken();
      if (pending.has(token)) throw new Error("Could not allocate a unique replacement session");
      pending.set(token, {
        datasetId,
        sourcePath,
        expiresAt: options.now() + replacementSessionLifetimeMs,
      });
      return token;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt < options.now()) {
        throw new Error("Replacement session expired or has already been used");
      }
      return { datasetId: session.datasetId, sourcePath: session.sourcePath };
    },
  };
}
