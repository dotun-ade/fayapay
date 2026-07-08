import { verifyDojahSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { DojahWebhookEvent } from './types.js';

export const DOJAH_HEADER = 'x-dojah-signature';

export function parseDojahWebhook<T = unknown>(opts: {
  rawBody: Buffer;
  signature: string;
  secret?: string;
}): DojahWebhookEvent<T> {
  const secret = opts.secret ?? requiredEnv('DOJAH_WEBHOOK_SECRET');
  if (!verifyDojahSignature(opts.rawBody, opts.signature, secret)) {
    throw new WebhookSignatureError('dojah');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as DojahWebhookEvent<T>;
}
