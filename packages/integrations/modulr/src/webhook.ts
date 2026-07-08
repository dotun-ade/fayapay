import { verifyModulrSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { ModulrWebhookEvent } from './types.js';

export const MODULR_HEADER = 'x-mod-hmac-sha-256';

export function parseModulrWebhook(opts: {
  rawBody: Buffer;
  signature: string;
  secret?: string;
}): ModulrWebhookEvent {
  const secret = opts.secret ?? requiredEnv('MODULR_HMAC_SECRET');
  if (!verifyModulrSignature(opts.rawBody, opts.signature, secret)) {
    throw new WebhookSignatureError('modulr');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as ModulrWebhookEvent;
}
