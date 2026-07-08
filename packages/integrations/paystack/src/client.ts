import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  PaystackBank,
  PaystackCustomer,
  PaystackEnvelope,
  PaystackTransaction,
  PaystackTransfer,
  PaystackTransferRecipient,
} from './types.js';

/**
 * Paystack client.
 * Auth: `Authorization: Bearer <secret_key>`.
 * Base: https://api.paystack.co
 *
 * Money: KOBO (NGN minor). Always integer.
 */
export class PaystackClient {
  private readonly http: HttpClient;

  constructor(opts?: { baseUrl?: string; secretKey?: string }) {
    const baseUrl = opts?.baseUrl ?? optionalEnv('PAYSTACK_BASE_URL', 'https://api.paystack.co')!;
    const secretKey = opts?.secretKey ?? requiredEnv('PAYSTACK_SECRET_KEY');
    this.http = new HttpClient({
      provider: 'paystack',
      baseUrl,
      defaultHeaders: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/json',
      },
    });
  }

  // ---- Customers ----

  async createCustomer(input: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  }) {
    const r = await this.http.post<PaystackEnvelope<PaystackCustomer>>('/customer', input);
    return r.data;
  }

  async getCustomer(emailOrCode: string) {
    const r = await this.http.get<PaystackEnvelope<PaystackCustomer>>(
      `/customer/${encodeURIComponent(emailOrCode)}`,
    );
    return r.data;
  }

  /** Validate customer with BVN (NG). */
  async validateCustomer(customer_code: string, input: {
    country: 'NG';
    type: 'bank_account';
    account_number: string;
    bvn: string;
    bank_code: string;
    first_name: string;
    last_name: string;
  }) {
    const r = await this.http.post<PaystackEnvelope<{ status: string }>>(
      `/customer/${customer_code}/identification`,
      input,
    );
    return r.data;
  }

  // ---- Dedicated virtual accounts (DVA) ----

  async createDedicatedAccount(input: {
    customer: string;
    preferred_bank?: 'wema-bank' | 'titan-paystack';
    subaccount?: string;
    split_code?: string;
  }) {
    const r = await this.http.post<
      PaystackEnvelope<{
        bank: { name: string; id: number; slug: string };
        account_name: string;
        account_number: string;
        assigned: boolean;
        currency: string;
        active: boolean;
        id: number;
        customer: { id: number; customer_code: string };
      }>
    >('/dedicated_account', input);
    return r.data;
  }

  // ---- Charge (init transactions / charge auth code) ----

  async initializeTransaction(input: {
    email: string;
    amount: number; // kobo
    reference?: string;
    callback_url?: string;
    channels?: Array<'card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer'>;
    metadata?: Record<string, unknown>;
  }) {
    const r = await this.http.post<
      PaystackEnvelope<{ authorization_url: string; access_code: string; reference: string }>
    >('/transaction/initialize', input);
    return r.data;
  }

  async verifyTransaction(reference: string) {
    const r = await this.http.get<PaystackEnvelope<PaystackTransaction>>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return r.data;
  }

  async chargeAuthorization(input: {
    authorization_code: string;
    email: string;
    amount: number; // kobo
    reference?: string;
    metadata?: Record<string, unknown>;
  }) {
    const r = await this.http.post<PaystackEnvelope<PaystackTransaction>>(
      '/transaction/charge_authorization',
      input,
    );
    return r.data;
  }

  // ---- Transfers ----

  async listBanks(query?: { country?: string; currency?: string; type?: string }) {
    const r = await this.http.get<PaystackEnvelope<PaystackBank[]>>('/bank', {
      query: query as Record<string, string | undefined>,
    });
    return r.data;
  }

  async resolveAccount(account_number: string, bank_code: string) {
    const r = await this.http.get<
      PaystackEnvelope<{ account_number: string; account_name: string; bank_id: number }>
    >('/bank/resolve', { query: { account_number, bank_code } });
    return r.data;
  }

  async createTransferRecipient(input: {
    type: 'nuban' | 'mobile_money' | 'ghipss';
    name: string;
    account_number: string;
    bank_code: string;
    currency: 'NGN' | 'GHS';
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const r = await this.http.post<PaystackEnvelope<PaystackTransferRecipient>>(
      '/transferrecipient',
      input,
    );
    return r.data;
  }

  async initiateTransfer(input: {
    source: 'balance';
    amount: number; // kobo
    recipient: string;
    reason?: string;
    reference?: string;
  }) {
    const r = await this.http.post<PaystackEnvelope<PaystackTransfer>>('/transfer', input);
    return r.data;
  }

  async finalizeTransfer(transfer_code: string, otp: string) {
    const r = await this.http.post<PaystackEnvelope<PaystackTransfer>>('/transfer/finalize_transfer', {
      transfer_code,
      otp,
    });
    return r.data;
  }

  async verifyTransfer(reference: string) {
    const r = await this.http.get<PaystackEnvelope<PaystackTransfer>>(
      `/transfer/verify/${encodeURIComponent(reference)}`,
    );
    return r.data;
  }

  // ---- Balance + settlements ----

  async getBalance() {
    const r = await this.http.get<
      PaystackEnvelope<Array<{ currency: string; balance: number }>>
    >('/balance');
    return r.data;
  }

  async listSettlements(query?: { perPage?: number; page?: number; from?: string; to?: string }) {
    return this.http.get<
      PaystackEnvelope<
        Array<{
          id: number;
          domain: string;
          status: string;
          currency: string;
          integration: number;
          total_amount: number;
          total_fees: number;
          settlement_date: string;
          settled_by_date: string | null;
        }>
      >
    >('/settlement', { query: query as Record<string, string | number | undefined> });
  }
}
