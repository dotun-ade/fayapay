import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  CcAuth,
  CcAccount,
  CcBalance,
  CcBeneficiary,
  CcConversion,
  CcFundingAccount,
  CcPayment,
} from './types.js';

/**
 * Currencycloud client.
 * Auth flow:
 *   POST /authenticate/api { login_id, api_key } -> { auth_token }
 *   Then every request sets `X-Auth-Token: <token>`.
 *
 * Tokens expire after 30 minutes of inactivity. We auto-refresh on 401.
 * Forms are www-form-urlencoded, not JSON. (Yes.)
 */
export class CurrencycloudClient {
  private readonly baseUrl: string;
  private readonly loginId: string;
  private readonly apiKey: string;
  private token?: string;
  private tokenAcquiredAt?: number;
  private http: HttpClient;

  constructor(opts?: { baseUrl?: string; loginId?: string; apiKey?: string }) {
    this.baseUrl =
      opts?.baseUrl ?? optionalEnv('CURRENCYCLOUD_BASE_URL', 'https://devapi.currencycloud.com/v2')!;
    this.loginId = opts?.loginId ?? requiredEnv('CURRENCYCLOUD_LOGIN_ID');
    this.apiKey = opts?.apiKey ?? requiredEnv('CURRENCYCLOUD_API_KEY');
    this.http = new HttpClient({
      provider: 'currencycloud',
      baseUrl: this.baseUrl,
      defaultHeaders: { 'content-type': 'application/x-www-form-urlencoded' },
    });
  }

  private async authenticate(): Promise<string> {
    const body = new URLSearchParams({ login_id: this.loginId, api_key: this.apiKey }).toString();
    const r = await this.http.request<CcAuth>({
      method: 'POST',
      path: '/authenticate/api',
      rawBody: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.token = r.auth_token;
    this.tokenAcquiredAt = Date.now();
    return r.auth_token;
  }

  private async withAuth<T>(fn: (headers: Record<string, string>) => Promise<T>): Promise<T> {
    if (!this.token || (Date.now() - (this.tokenAcquiredAt ?? 0)) > 25 * 60_000) {
      await this.authenticate();
    }
    try {
      return await fn({ 'x-auth-token': this.token! });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 401) {
        await this.authenticate();
        return fn({ 'x-auth-token': this.token! });
      }
      throw err;
    }
  }

  private form(body: Record<string, unknown>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) u.set(k, String(v));
    return u.toString();
  }

  // ---- Accounts ----

  createAccount(input: { account_name: string; legal_entity_type: 'individual' | 'company'; your_reference?: string; country?: string }) {
    return this.withAuth((h) =>
      this.http.request<{ id: string }>({
        method: 'POST',
        path: '/accounts/create',
        rawBody: this.form(input),
        headers: { ...h, 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );
  }

  getAccount(id: string) {
    return this.withAuth((h) =>
      this.http.get<CcAccount>(`/accounts/${id}`, { headers: h }),
    );
  }

  // ---- Balances ----

  getBalance(currency: string, account_id?: string) {
    return this.withAuth((h) =>
      this.http.get<CcBalance>(`/balances/${currency}`, {
        headers: h,
        query: account_id ? { on_behalf_of: account_id } : undefined,
      }),
    );
  }

  // ---- Funding (collection) accounts ----

  findFundingAccounts(query: { account_id?: string; currency?: string; payment_type?: 'regular' | 'priority' }) {
    return this.withAuth((h) =>
      this.http.get<{ funding_accounts: CcFundingAccount[] }>('/funding_accounts/find', {
        headers: h,
        query: query as Record<string, string | undefined>,
      }),
    );
  }

  // ---- Beneficiaries ----

  createBeneficiary(input: {
    bank_country: string;
    currency: string;
    beneficiary_country?: string;
    account_number?: string;
    iban?: string;
    bic_swift?: string;
    bank_account_holder_name: string;
    name: string;
    routing_code_type_1?: string;
    routing_code_value_1?: string;
  }) {
    return this.withAuth((h) =>
      this.http.request<CcBeneficiary>({
        method: 'POST',
        path: '/beneficiaries/create',
        rawBody: this.form(input),
        headers: { ...h, 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );
  }

  // ---- Conversions ----

  createConversion(input: {
    buy_currency: string;
    sell_currency: string;
    fixed_side: 'buy' | 'sell';
    amount: string;
    reason?: string;
    term_agreement: true;
    unique_request_id?: string;
  }) {
    return this.withAuth((h) =>
      this.http.request<CcConversion>({
        method: 'POST',
        path: '/conversions/create',
        rawBody: this.form(input),
        headers: { ...h, 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );
  }

  // ---- Payments ----

  createPayment(input: {
    currency: string;
    beneficiary_id: string;
    amount: string;
    reason: string;
    reference: string;
    payment_type?: 'regular' | 'priority';
    conversion_id?: string;
    unique_request_id?: string;
  }) {
    return this.withAuth((h) =>
      this.http.request<CcPayment>({
        method: 'POST',
        path: '/payments/create',
        rawBody: this.form(input),
        headers: { ...h, 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );
  }

  getPayment(id: string) {
    return this.withAuth((h) => this.http.get<CcPayment>(`/payments/${id}`, { headers: h }));
  }
}
