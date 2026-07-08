export class FayapayError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends FayapayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('validation_error', message, 422, details);
  }
}

export class NotFoundError extends FayapayError {
  constructor(resource: string, id?: string) {
    super('not_found', `${resource} not found${id ? `: ${id}` : ''}`, 404, { resource, id });
  }
}

export class UnauthorizedError extends FayapayError {
  constructor(message = 'Unauthorized') {
    super('unauthorized', message, 401);
  }
}

export class ForbiddenError extends FayapayError {
  constructor(message = 'Forbidden') {
    super('forbidden', message, 403);
  }
}

export class ConflictError extends FayapayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('conflict', message, 409, details);
  }
}

export class RateLimitedError extends FayapayError {
  constructor(public readonly retryAfterSeconds: number) {
    super('rate_limited', 'Rate limit exceeded', 429, { retryAfterSeconds });
  }
}

export class ProviderError extends FayapayError {
  public readonly provider: string;
  public readonly providerCode?: string;
  public readonly retryable: boolean;

  constructor(opts: {
    provider: string;
    message: string;
    statusCode?: number;
    providerCode?: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(
      `provider_error.${opts.provider}`,
      `[${opts.provider}] ${opts.message}`,
      opts.statusCode ?? 502,
      opts.details,
    );
    this.provider = opts.provider;
    this.providerCode = opts.providerCode;
    this.retryable = opts.retryable ?? false;
  }
}

export class InsufficientFundsError extends FayapayError {
  constructor(accountId: string, available: bigint, requested: bigint, currency: string) {
    super('insufficient_funds', `Insufficient funds on account ${accountId}`, 422, {
      accountId,
      available: available.toString(),
      requested: requested.toString(),
      currency,
    });
  }
}

export class WebhookSignatureError extends FayapayError {
  constructor(provider: string) {
    super('invalid_webhook_signature', `Invalid webhook signature from ${provider}`, 400, {
      provider,
    });
  }
}
