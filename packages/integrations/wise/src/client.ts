import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  WiseBalance,
  WiseProfile,
  WiseQuote,
  WiseRecipient,
  WiseTransfer,
} from './types.js';

/**
 * Wise (Platform API) client.
 * Auth: `Authorization: Bearer <api token>`.
 * Sandbox: https://api.sandbox.transferwise.tech
 *
 * Profile-scoped: most endpoints take a profile id. Set via WISE_PROFILE_ID
 * or pass on each call.
 */
export class WiseClient {
  private readonly http: HttpClient;
  private readonly defaultProfileId?: number;

  constructor(opts?: { baseUrl?: string; token?: string; profileId?: number }) {
    const baseUrl =
      opts?.baseUrl ?? optionalEnv('WISE_BASE_URL', 'https://api.sandbox.transferwise.tech')!;
    const token = opts?.token ?? requiredEnv('WISE_API_TOKEN');
    this.http = new HttpClient({
      provider: 'wise',
      baseUrl,
      defaultHeaders: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });
    const pidStr = optionalEnv('WISE_PROFILE_ID');
    this.defaultProfileId = opts?.profileId ?? (pidStr ? Number.parseInt(pidStr, 10) : undefined);
  }

  private get profileId(): number {
    if (!this.defaultProfileId) throw new Error('WISE_PROFILE_ID not configured');
    return this.defaultProfileId;
  }

  // ---- Profiles ----

  listProfiles() {
    return this.http.get<WiseProfile[]>('/v1/profiles');
  }

  getProfile(id: number) {
    return this.http.get<WiseProfile>(`/v1/profiles/${id}`);
  }

  // ---- Balances ----

  listBalances(profileId = this.profileId, types: 'STANDARD' | 'SAVINGS' = 'STANDARD') {
    return this.http.get<WiseBalance[]>(`/v4/profiles/${profileId}/balances`, {
      query: { types },
    });
  }

  createBalance(input: { profileId?: number; currency: string; type?: 'STANDARD' | 'SAVINGS' }) {
    const pid = input.profileId ?? this.profileId;
    return this.http.post<WiseBalance>(`/v4/profiles/${pid}/balances`, {
      currency: input.currency,
      type: input.type ?? 'STANDARD',
    });
  }

  // ---- Quotes ----

  createQuote(input: {
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmount?: number;
    targetAmount?: number;
    payOut?: 'BANK_TRANSFER' | 'BALANCE' | 'SWIFT';
    profile?: number;
  }) {
    const profile = input.profile ?? this.profileId;
    return this.http.post<WiseQuote>('/v3/quotes', { ...input, profile });
  }

  getQuote(id: string) {
    return this.http.get<WiseQuote>(`/v3/quotes/${id}`);
  }

  // ---- Recipients ----

  createRecipient(input: {
    currency: string;
    type: string;
    profile?: number;
    accountHolderName: string;
    details: Record<string, unknown>;
  }) {
    return this.http.post<WiseRecipient>('/v1/accounts', {
      ...input,
      profile: input.profile ?? this.profileId,
    });
  }

  getRecipient(id: number) {
    return this.http.get<WiseRecipient>(`/v1/accounts/${id}`);
  }

  // ---- Transfers ----

  createTransfer(input: {
    targetAccount: number;
    quoteUuid: string;
    customerTransactionId: string; // UUID, idempotency
    details?: { reference?: string; transferPurpose?: string; sourceOfFunds?: string };
  }) {
    return this.http.post<WiseTransfer>('/v1/transfers', input);
  }

  fundTransfer(transferId: number, profileId = this.profileId) {
    return this.http.post<{ type: 'BALANCE'; status: 'COMPLETED' | 'REJECTED' }>(
      `/v3/profiles/${profileId}/transfers/${transferId}/payments`,
      { type: 'BALANCE' },
    );
  }

  getTransfer(id: number) {
    return this.http.get<WiseTransfer>(`/v1/transfers/${id}`);
  }

  cancelTransfer(id: number) {
    return this.http.put<WiseTransfer>(`/v1/transfers/${id}/cancel`);
  }
}
