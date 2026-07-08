import { createHmac, randomUUID } from 'node:crypto';
import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  ModulrAccount,
  ModulrBeneficiary,
  ModulrCustomer,
  ModulrPayment,
} from './types.js';

/**
 * Modulr client.
 *
 * Auth: HTTP Signatures, RFC-draft. Every request needs:
 *   Date: <RFC1123 date>
 *   x-mod-nonce: <random>
 *   Authorization: Signature keyId="<api_key>", algorithm="hmac-sha1",
 *     headers="date x-mod-nonce", signature="<base64 hmac-sha1 over signing string>"
 *
 * The signing string is `date: <date>\nx-mod-nonce: <nonce>`. Yes, hmac-sha1.
 * That's not our choice — Modulr requires it. (See ADR-0012 for the security review.)
 */
export class ModulrClient {
  private readonly http: HttpClient;
  private readonly apiKey: string;
  private readonly hmacSecret: string;
  private readonly customerId?: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string; hmacSecret?: string; customerId?: string }) {
    const baseUrl =
      opts?.baseUrl ??
      optionalEnv('MODULR_BASE_URL', 'https://api-sandbox.modulrfinance.com/api-sandbox')!;
    this.apiKey = opts?.apiKey ?? requiredEnv('MODULR_API_KEY');
    this.hmacSecret = opts?.hmacSecret ?? requiredEnv('MODULR_HMAC_SECRET');
    this.customerId = opts?.customerId ?? optionalEnv('MODULR_CUSTOMER_ID');
    this.http = new HttpClient({
      provider: 'modulr',
      baseUrl,
      defaultHeaders: { 'content-type': 'application/json' },
    });
  }

  private authHeaders(): Record<string, string> {
    const date = new Date().toUTCString();
    const nonce = randomUUID();
    const signingString = `date: ${date}\nx-mod-nonce: ${nonce}`;
    const signature = createHmac('sha1', this.hmacSecret).update(signingString).digest('base64');
    return {
      date,
      'x-mod-nonce': nonce,
      authorization: `Signature keyId="${this.apiKey}", algorithm="hmac-sha1", headers="date x-mod-nonce", signature="${signature}"`,
    };
  }

  // ---- Customers ----

  createCustomer(input: Partial<ModulrCustomer> & { type: ModulrCustomer['type']; name?: string }) {
    return this.http.post<ModulrCustomer>('/customers', input, { headers: this.authHeaders() });
  }

  getCustomer(id: string) {
    return this.http.get<ModulrCustomer>(`/customers/${id}`, { headers: this.authHeaders() });
  }

  // ---- Accounts ----

  createAccount(input: { currency: 'GBP' | 'EUR'; externalReference?: string; productCode?: string; customerId?: string }) {
    const cid = input.customerId ?? this.customerId;
    if (!cid) throw new Error('customerId required (set MODULR_CUSTOMER_ID)');
    return this.http.post<ModulrAccount>(`/customers/${cid}/accounts`, input, {
      headers: this.authHeaders(),
    });
  }

  getAccount(id: string) {
    return this.http.get<ModulrAccount>(`/accounts/${id}`, { headers: this.authHeaders() });
  }

  listAccounts(query?: { customerId?: string; page?: number; size?: number }) {
    return this.http.get<{ content: ModulrAccount[]; totalSize: number }>('/accounts', {
      headers: this.authHeaders(),
      query: query as Record<string, string | number | undefined>,
    });
  }

  // ---- Beneficiaries ----

  createBeneficiary(customerId: string, input: {
    name: string;
    qualifier?: 'OUTGOING';
    destinationIdentifier: ModulrBeneficiary['destinationIdentifier'];
  }) {
    return this.http.post<ModulrBeneficiary>(`/customers/${customerId}/beneficiaries`, input, {
      headers: this.authHeaders(),
    });
  }

  // ---- Payments ----

  createPayment(input: {
    sourceAccountId: string;
    destination: ModulrPayment['destination'];
    amount: number;
    currency: 'GBP' | 'EUR';
    reference: string;
    externalReference?: string;
  }) {
    return this.http.post<ModulrPayment>('/payments', input, {
      headers: this.authHeaders(),
      idempotencyKey: input.externalReference ?? randomUUID(),
    });
  }

  getPayment(id: string) {
    return this.http.get<ModulrPayment>(`/payments/${id}`, { headers: this.authHeaders() });
  }

  // ---- Confirmation of Payee (UK) ----

  confirmPayee(input: { accountNumber: string; sortCode: string; name: string; type: 'PERSONAL' | 'BUSINESS' }) {
    return this.http.post<{
      matched: boolean;
      reason?: string;
      actualName?: string;
    }>('/account-name-check', input, { headers: this.authHeaders() });
  }
}
