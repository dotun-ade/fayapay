import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  DojahBvnRecord,
  DojahCacRecord,
  DojahEnvelope,
  DojahNinRecord,
} from './types.js';

/**
 * Dojah client.
 *
 * Auth: two headers — `AppId: <app_id>` and `Authorization: <secret_key>`
 *       (no Bearer prefix on Authorization).
 * Sandbox: https://sandbox.dojah.io
 */
export class DojahClient {
  private readonly http: HttpClient;

  constructor(opts?: { baseUrl?: string; appId?: string; secretKey?: string }) {
    const baseUrl = opts?.baseUrl ?? optionalEnv('DOJAH_BASE_URL', 'https://sandbox.dojah.io')!;
    const appId = opts?.appId ?? requiredEnv('DOJAH_APP_ID');
    const secretKey = opts?.secretKey ?? requiredEnv('DOJAH_SECRET_KEY');
    this.http = new HttpClient({
      provider: 'dojah',
      baseUrl,
      defaultHeaders: {
        AppId: appId,
        authorization: secretKey,
        'content-type': 'application/json',
      },
    });
  }

  // ---- BVN ----

  /**
   * Basic BVN lookup. Returns name, dob, phone. Doesn't include image.
   * For image + selfie match, use `bvnAdvance`.
   */
  async lookupBvn(bvn: string): Promise<DojahBvnRecord> {
    const r = await this.http.get<DojahEnvelope<DojahBvnRecord>>('/api/v1/kyc/bvn/full', {
      query: { bvn },
    });
    return r.entity;
  }

  /** BVN with selfie verification. */
  async bvnSelfieMatch(input: { bvn: string; selfie_image: string }): Promise<{
    selfie_verification: { match: boolean; confidence_value: number };
    entity: DojahBvnRecord;
  }> {
    return this.http.post('/api/v1/kyc/bvn/verify', input);
  }

  // ---- NIN ----

  async lookupNin(nin: string): Promise<DojahNinRecord> {
    const r = await this.http.get<DojahEnvelope<DojahNinRecord>>('/api/v1/kyc/nin', {
      query: { nin },
    });
    return r.entity;
  }

  // ---- Phone lookup ----

  async phoneLookup(phone_number: string) {
    return this.http.get<DojahEnvelope<{ phone_number: string; first_name?: string; last_name?: string; carrier?: string }>>(
      '/api/v1/kyc/phone_number',
      { query: { phone_number } },
    );
  }

  // ---- Bank account ----

  async resolveBank(input: { account_number: string; bank_code: string }) {
    return this.http.get<
      DojahEnvelope<{ account_name: string; account_number: string; bank_code: string }>
    >('/api/v1/kyc/nuban', { query: input });
  }

  // ---- CAC (business registration) ----

  async lookupCac(rc_number: string): Promise<DojahCacRecord> {
    const r = await this.http.get<DojahEnvelope<DojahCacRecord>>('/api/v1/kyc/business', {
      query: { rc_number },
    });
    return r.entity;
  }

  // ---- AML screening ----

  async amlScreen(input: { first_name: string; last_name: string; match?: 'strict' | 'fuzzy' }) {
    return this.http.post<{
      entity: { name: string; match: boolean; details?: unknown };
    }>('/api/v1/aml/screening/individual', input);
  }
}
