import { z } from 'zod';

/**
 * Tiny env loader. We don't pull in dotenv-flow / @t3-oss/env etc here —
 * services bring their own schemas. This just gives a typed required() helper.
 */
export function requiredEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export function optionalEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export function boolEnv(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

export function intEnv(key: string, fallback?: number): number {
  const v = process.env[key];
  if (v === undefined) {
    if (fallback === undefined) throw new Error(`Missing required env var: ${key}`);
    return fallback;
  }
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer for ${key}: ${v}`);
  return n;
}

export function parseEnv<S extends z.ZodTypeAny>(schema: S): z.infer<S> {
  const res = schema.safeParse(process.env);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return res.data;
}
