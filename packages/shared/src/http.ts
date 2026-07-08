import { ProviderError } from './errors.js';
import { logger } from './logger.js';
import { retry, type RetryOptions } from './retry.js';

export interface HttpClientOptions {
  baseUrl: string;
  provider: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  retry?: RetryOptions;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: Buffer | string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * Small fetch wrapper used by integration packages.
 * - Adds timeout + retry on 5xx / network.
 * - Surfaces provider errors as ProviderError so the API layer can map to 502.
 * - Logs request/response with provider tag (PII is redacted by the logger).
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly provider: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retryOpts: RetryOptions;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.provider = opts.provider;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.retryOpts = opts.retry ?? { attempts: 3 };
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    const method = opts.method ?? 'GET';
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.defaultHeaders,
      ...opts.headers,
    };
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
    let body: BodyInit | undefined;
    if (opts.rawBody !== undefined) {
      body = opts.rawBody;
    } else if (opts.body !== undefined) {
      headers['content-type'] ??= 'application/json';
      body = JSON.stringify(opts.body);
    }

    return retry(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const signal = opts.signal
        ? anySignal([controller.signal, opts.signal])
        : controller.signal;

      const started = Date.now();
      try {
        const res = await fetch(url, { method, headers, body, signal });
        const latencyMs = Date.now() - started;
        const text = await res.text();
        const parsed = text ? safeJson(text) : null;
        logger.debug(
          { provider: this.provider, method, url, status: res.status, latencyMs },
          'provider request',
        );
        if (!res.ok) {
          throw new ProviderError({
            provider: this.provider,
            message: extractMessage(parsed) ?? `HTTP ${res.status}`,
            statusCode: res.status,
            providerCode: extractCode(parsed),
            retryable: res.status >= 500 || res.status === 429,
            details: { url, body: parsed },
          });
        }
        return parsed as T;
      } finally {
        clearTimeout(timer);
      }
    }, this.retryOpts);
  }

  get<T>(path: string, opts: Omit<RequestOptions, 'method' | 'path'> = {}) {
    return this.request<T>({ ...opts, method: 'GET', path });
  }
  post<T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) {
    return this.request<T>({ ...opts, method: 'POST', path, body });
  }
  put<T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) {
    return this.request<T>({ ...opts, method: 'PUT', path, body });
  }
  patch<T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) {
    return this.request<T>({ ...opts, method: 'PATCH', path, body });
  }
  delete<T>(path: string, opts: Omit<RequestOptions, 'method' | 'path'> = {}) {
    return this.request<T>({ ...opts, method: 'DELETE', path });
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const u = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return typeof parsed === 'string' ? parsed : undefined;
  const o = parsed as Record<string, unknown>;
  return (
    (typeof o['message'] === 'string' && o['message']) ||
    (typeof o['error'] === 'string' && o['error']) ||
    (typeof o['error_description'] === 'string' && o['error_description']) ||
    (Array.isArray(o['errors']) && o['errors'][0] && JSON.stringify(o['errors'][0])) ||
    undefined
  );
}

function extractCode(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const o = parsed as Record<string, unknown>;
  return (
    (typeof o['code'] === 'string' && o['code']) ||
    (typeof o['error_code'] === 'string' && o['error_code']) ||
    undefined
  );
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      return controller.signal;
    }
    s.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
