import { verifyFlutterwaveHash, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { FlwWebhookEvent } from './types.js';

export const FLW_HEADER = 'verif-hash';

/**
 * Flutterwave webhook auth is a *static* hash: whatever you set as `secret_hash`
 * in the dashboard is echoed back in `verif-hash`. NOT HMAC. People keep
 * confusing this. Compare verbatim in constant time.
 */
export function parseFlwWebhook<T = unknown>(opts: {
  rawBody: Buffer;
  verifHash: string;
  configuredHash?: string;
}): FlwWebhookEvent<T> {
  const configured = opts.configuredHash ?? requiredEnv('FLUTTERWAVE_WEBHOOK_SECRET');
  if (!verifyFlutterwaveHash(opts.verifHash, configured)) {
    throw new WebhookSignatureError('flutterwave');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as FlwWebhookEvent<T>;
}
