import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  FlwBank,
  FlwCharge,
  FlwEnvelope,
  FlwTransfer,
  FlwVirtualAccount,
} from './types.js';

/**
 * Flutterwave v3 client.
 * Auth: `Authorization: Bearer <secret_key>`.
 * Base: https://api.flutterwave.com/v3
 *
 * Money: MAJOR units (NGN, KES, etc). Float in the wire, but we always pass integers
 * for whole-currency amounts to avoid float rounding surprises.
 *
 * Quirk: `tx_ref` is the *merchant* reference. `flw_ref` is theirs. We always send
 * a tx_ref so we can reconcile.
 */
export class FlutterwaveClient {
  private readonly http: HttpClient;

  constructor(opts?: { baseUrl?: string; secretKey?: string }) {
    const baseUrl =
      opts?.baseUrl ?? optionalEnv('FLUTTERWAVE_BASE_URL', 'https://api.flutterwave.com/v3')!;
    const secretKey = opts?.secretKey ?? requiredEnv('FLUTTERWAVE_SECRET_KEY');
    this.http = new HttpClient({
      provider: 'flutterwave',
      baseUrl,
      defaultHeaders: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/json',
      },
    });
  }

  // ---- Banks ----

  async listBanks(country: 'NG' | 'GH' | 'KE' | 'UG' | 'TZ' | 'ZA' | 'RW' = 'NG') {
    const r = await this.http.get<FlwEnvelope<FlwBank[]>>(`/banks/${country}`);
    return r.data;
  }

  async resolveAccount(input: { account_number: string; account_bank: string }) {
    const r = await this.http.post<FlwEnvelope<{ account_number: string; account_name: string }>>(
      '/accounts/resolve',
      input,
    );
    return r.data;
  }

  // ---- Charges (collection) ----

  async chargeCard(input: {
    tx_ref: string;
    amount: number;
    currency: string;
    email: string;
    fullname: string;
    card_number: string; // encrypted before send, see encryptPayload
    cvv: string;
    expiry_month: string;
    expiry_year: string;
    redirect_url: string;
    enckey?: string;
  }) {
    const r = await this.http.post<FlwEnvelope<FlwCharge>>('/charges?type=card', input);
    return r.data;
  }

  /**
   * Generate a bank transfer payment instrument. Flutterwave returns a one-time
   * NUBAN with an expiry. Customer pays into it, we get charge.completed.
   */
  async createBankTransferCharge(input: {
    tx_ref: string;
    amount: number;
    currency: 'NGN';
    email: string;
    phone_number?: string;
    fullname?: string;
    is_permanent?: boolean;
    narration?: string;
  }) {
    const r = await this.http.post<
      FlwEnvelope<{
        transfer_reference: string;
        transfer_account: string;
        transfer_bank: string;
        account_expiration: string;
        transfer_note: string;
        transfer_amount: number;
        mode: 'banktransfer';
      }>
    >('/charges?type=bank_transfer', input);
    return r.data;
  }

  async verifyCharge(id: number | string) {
    const r = await this.http.get<FlwEnvelope<FlwCharge>>(`/transactions/${id}/verify`);
    return r.data;
  }

  async verifyChargeByRef(tx_ref: string) {
    const r = await this.http.get<FlwEnvelope<FlwCharge>>(
      `/transactions/verify_by_reference`,
      { query: { tx_ref } },
    );
    return r.data;
  }

  // ---- Transfers (payouts) ----

  async createTransfer(input: {
    account_bank: string;
    account_number: string;
    amount: number;
    narration?: string;
    currency: string;
    reference: string;
    callback_url?: string;
    debit_currency?: string;
    beneficiary_name?: string;
    meta?: Array<{ first_name?: string; last_name?: string; mobile_number?: string }>;
  }) {
    const r = await this.http.post<FlwEnvelope<FlwTransfer>>('/transfers', input);
    return r.data;
  }

  async getTransfer(id: number | string) {
    const r = await this.http.get<FlwEnvelope<FlwTransfer>>(`/transfers/${id}`);
    return r.data;
  }

  async getTransferFee(opts: { amount: number; currency: string }) {
    return this.http.get<
      FlwEnvelope<Array<{ currency: string; fee_type: string; fee: number }>>
    >('/transfers/fee', { query: opts as Record<string, string | number> });
  }

  // ---- Virtual accounts (Naira receivables) ----

  async createVirtualAccount(input: {
    email: string;
    is_permanent?: boolean;
    bvn?: string;
    tx_ref: string;
    phonenumber?: string;
    firstname?: string;
    lastname?: string;
    narration?: string;
    amount?: number;
    frequency?: number;
  }) {
    const r = await this.http.post<FlwEnvelope<FlwVirtualAccount>>('/virtual-account-numbers', input);
    return r.data;
  }

  // ---- Balance ----

  async getBalances() {
    return this.http.get<
      FlwEnvelope<
        Array<{ currency: string; ledger_balance: number; available_balance: number }>
      >
    >('/balances');
  }

  // ---- FX (rates) ----

  async getFxRate(input: { amount: number; destination_currency: string; source_currency: string }) {
    return this.http.get<
      FlwEnvelope<{ rate: number; source: { amount: number; currency: string }; destination: { amount: number; currency: string } }>
    >('/rates', { query: input as Record<string, string | number> });
  }
}
