import { createHmac, timingSafeEqual, createVerify } from 'node:crypto';

/**
 * Generic HMAC-SHA verifier. Returns true on match in constant time.
 * Always pass the *raw request body* — JSON.stringify(req.body) will not match.
 */
export function verifyHmac(opts: {
  secret: string;
  payload: string | Buffer;
  signature: string;
  algorithm?: 'sha256' | 'sha512' | 'sha1';
  encoding?: 'hex' | 'base64';
}): boolean {
  const { secret, payload, signature, algorithm = 'sha256', encoding = 'hex' } = opts;
  const computed = createHmac(algorithm, secret).update(payload).digest(encoding);
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Paystack: `x-paystack-signature` header is HMAC-SHA512 hex over the raw body
 * using the merchant secret key (NOT the public key). See:
 *   https://paystack.com/docs/payments/webhooks
 */
export function verifyPaystackSignature(payload: Buffer, signature: string, secret: string) {
  return verifyHmac({ secret, payload, signature, algorithm: 'sha512', encoding: 'hex' });
}

/**
 * Flutterwave: `verif-hash` header — this is NOT an HMAC. Flutterwave just
 * echoes back whatever string you set as `secret_hash` in the dashboard.
 * Compare verbatim in constant time.
 */
export function verifyFlutterwaveHash(receivedHash: string, configuredHash: string) {
  const a = Buffer.from(receivedHash);
  const b = Buffer.from(configuredHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Sudo Africa: `x-sudo-signature` header is HMAC-SHA512 hex over the raw body.
 * The signing key is the webhook secret from the dashboard, not the API key.
 */
export function verifySudoSignature(payload: Buffer, signature: string, secret: string) {
  return verifyHmac({ secret, payload, signature, algorithm: 'sha512', encoding: 'hex' });
}

/**
 * Wise: detached RSA-SHA256 signature in `X-Signature-SHA256`, base64.
 * Public key is published at https://wise.com/public-keys/notifications/<env>.
 * Caller must pass the PEM-encoded public key.
 */
export function verifyWiseSignature(opts: {
  payload: Buffer;
  signatureBase64: string;
  publicKeyPem: string;
}): boolean {
  const { payload, signatureBase64, publicKeyPem } = opts;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload);
  verifier.end();
  try {
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

/**
 * Modulr: HMAC-SHA512 over a canonical string `date: <date>\nx-mod-nonce: <nonce>`,
 * signed with the customer's HMAC secret. Header: `Authorization: Signature keyId=...,
 * algorithm="hmac-sha512", headers="date x-mod-nonce", signature="<base64>"`.
 * For webhooks Modulr also includes `X-Mod-Hmac-Sha-256` over the raw body — that's
 * what we check here.
 */
export function verifyModulrSignature(payload: Buffer, signature: string, secret: string) {
  return verifyHmac({ secret, payload, signature, algorithm: 'sha256', encoding: 'base64' });
}

/**
 * Currencycloud: `X-Cc-Signature` HMAC-SHA256 hex over the raw body using the
 * webhook secret from settings.
 */
export function verifyCurrencycloudSignature(payload: Buffer, signature: string, secret: string) {
  return verifyHmac({ secret, payload, signature, algorithm: 'sha256', encoding: 'hex' });
}

/**
 * Dojah: `x-dojah-signature` HMAC-SHA256 hex over raw body, key is webhook secret.
 */
export function verifyDojahSignature(payload: Buffer, signature: string, secret: string) {
  return verifyHmac({ secret, payload, signature, algorithm: 'sha256', encoding: 'hex' });
}
