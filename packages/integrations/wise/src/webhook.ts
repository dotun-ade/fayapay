import { readFileSync } from 'node:fs';
import { verifyWiseSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { WiseWebhookPayload } from './types.js';

export const WISE_HEADER_SIGNATURE = 'x-signature-sha256';
export const WISE_HEADER_DELIVERY = 'x-delivery-id';
export const WISE_HEADER_TEST = 'x-test-notification';

let cachedPubKey: string | undefined;

function loadPubKey(): string {
  if (cachedPubKey) return cachedPubKey;
  const path = requiredEnv('WISE_WEBHOOK_PUBLIC_KEY_PATH');
  cachedPubKey = readFileSync(path, 'utf8');
  return cachedPubKey;
}

/**
 * Wise webhooks use a *detached* RSA-SHA256 signature over the raw body.
 * Verify with the public key from
 *   https://wise.com/public-keys/notifications/<env>
 *
 * NOTE: do not parse the body first. The signature is over the bytes as
 * delivered. Express + body-parser will silently mutate this; Fastify needs
 * `bodyLimit` + a raw body plugin.
 */
export function parseWiseWebhook<T = unknown>(opts: {
  rawBody: Buffer;
  signatureBase64: string;
  publicKeyPem?: string;
}): WiseWebhookPayload & { data: { resource: { id: number; type: string; profile_id: number } } } {
  const pubKey = opts.publicKeyPem ?? loadPubKey();
  if (
    !verifyWiseSignature({
      payload: opts.rawBody,
      signatureBase64: opts.signatureBase64,
      publicKeyPem: pubKey,
    })
  ) {
    throw new WebhookSignatureError('wise');
  }
  return JSON.parse(opts.rawBody.toString('utf8')) as WiseWebhookPayload &
    { data: { resource: { id: number; type: string; profile_id: number } } };
}
