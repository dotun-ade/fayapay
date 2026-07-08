import { verifyCurrencycloudSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { CcWebhookPayload } from './types.js';

export const CC_HEADER_SIGNATURE = 'x-cc-signature';

export function parseCcWebhook(opts: {
  rawBody: Buffer;
  signature: string;
  secret?: string;
}): CcWebhookPayload {
  const secret = opts.secret ?? requiredEnv('CURRENCYCLOUD_WEBHOOK_SECRET');
  if (!verifyCurrencycloudSignature(opts.rawBody, opts.signature, secret)) {
    throw new WebhookSignatureError('currencycloud');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as CcWebhookPayload;
}
