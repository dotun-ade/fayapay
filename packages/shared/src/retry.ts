export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  jitter?: boolean;
  retryIf?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number) => void;
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseMs = opts.baseMs ?? 200;
  const maxMs = opts.maxMs ?? 5_000;
  const retryIf = opts.retryIf ?? defaultRetryable;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !retryIf(err)) throw err;
      const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      const wait = opts.jitter === false ? exp : Math.floor(Math.random() * exp);
      opts.onRetry?.(err, attempt);
      await sleep(wait);
    }
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { statusCode?: number; code?: string; retryable?: boolean };
  if (e.retryable === true) return true;
  if (typeof e.statusCode === 'number') {
    if (e.statusCode >= 500) return true;
    if (e.statusCode === 408 || e.statusCode === 429) return true;
  }
  if (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED') return true;
  return false;
}
