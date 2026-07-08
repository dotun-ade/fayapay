import { verifySudoSignature, WebhookSignatureError, requiredEnv } from '@fayapay/shared';
import type { SudoWebhookEvent } from './types.js';

export interface SudoWebhookContext {
  rawBody: Buffer;
  signature: string;
  secret?: string;
}

export function parseSudoWebhook<T = unknown>(ctx: SudoWebhookContext): SudoWebhookEvent<T> {
  const secret = ctx.secret ?? requiredEnv('SUDO_WEBHOOK_SECRET');
  if (!verifySudoSignature(ctx.rawBody, ctx.signature, secret)) {
    throw new WebhookSignatureError('sudo');
  }
  return JSON.parse(ctx.rawBody.toString('utf8')) as SudoWebhookEvent<T>;
}

export const SUDO_WEBHOOK_HEADER = 'x-sudo-signature';
