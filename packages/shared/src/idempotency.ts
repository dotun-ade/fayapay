import { createHash, randomUUID } from 'node:crypto';

/**
 * Build a deterministic idempotency key from a logical operation and its inputs.
 * Use this when the caller did not supply one but we want re-entrancy on retries.
 */
export function deriveIdempotencyKey(operation: string, inputs: Record<string, unknown>): string {
  const sorted = JSON.stringify(inputs, Object.keys(inputs).sort());
  return `${operation}:${createHash('sha256').update(sorted).digest('hex').slice(0, 32)}`;
}

export function newIdempotencyKey(prefix = 'idem'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Dedupe key for inbound webhooks. Combine provider + their event id.
 * We persist this to webhook_events with a unique constraint; the second
 * delivery short-circuits at insert time.
 */
export function webhookDedupeKey(provider: string, providerEventId: string): string {
  return `${provider}:${providerEventId}`;
}
