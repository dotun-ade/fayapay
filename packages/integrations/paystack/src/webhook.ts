import { verifyPaystackSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { PaystackWebhookEvent } from './types.js';

export const PAYSTACK_HEADER = 'x-paystack-signature';

export function parsePaystackWebhook<T = unknown>(opts: {
  rawBody: Buffer;
  signature: string;
  secretKey?: string;
}): PaystackWebhookEvent<T> {
  // Paystack signs with the *secret_key*, not a separate webhook secret.
  const secret = opts.secretKey ?? requiredEnv('PAYSTACK_SECRET_KEY');
  if (!verifyPaystackSignature(opts.rawBody, opts.signature, secret)) {
    throw new WebhookSignatureError('paystack');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as PaystackWebhookEvent<T>;
}
