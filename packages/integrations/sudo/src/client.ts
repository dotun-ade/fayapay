import { HttpClient, requiredEnv, optionalEnv } from '@fayapay/shared';
import type {
  CreateCardInput,
  CreateCustomerInput,
  SudoCard,
  SudoCustomer,
  SudoEnvelope,
  SudoAuthorization,
} from './types.js';

/**
 * Sudo Africa client.
 * Auth: `Authorization: Bearer <api key>` (no `Bearer` prefix in their docs sample
 * for some endpoints — the raw key works either way; we use Bearer for consistency).
 * Sandbox base URL: https://api.sandbox.sudo.cards
 * Prod base URL:    https://api.sudo.cards
 */
export class SudoClient {
  private readonly http: HttpClient;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    const baseUrl = opts?.baseUrl ?? optionalEnv('SUDO_BASE_URL', 'https://api.sandbox.sudo.cards')!;
    const apiKey = opts?.apiKey ?? requiredEnv('SUDO_API_KEY');
    this.http = new HttpClient({
      provider: 'sudo',
      baseUrl,
      defaultHeaders: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      timeoutMs: 20_000,
    });
  }

  // --------- Customers ---------

  async createCustomer(input: CreateCustomerInput): Promise<SudoCustomer> {
    const res = await this.http.post<SudoEnvelope<SudoCustomer>>('/customers', input);
    return res.data;
  }

  async getCustomer(id: string): Promise<SudoCustomer> {
    const res = await this.http.get<SudoEnvelope<SudoCustomer>>(`/customers/${id}`);
    return res.data;
  }

  async updateCustomer(
    id: string,
    patch: Partial<Pick<SudoCustomer, 'status'>>,
  ): Promise<SudoCustomer> {
    const res = await this.http.put<SudoEnvelope<SudoCustomer>>(`/customers/${id}`, patch);
    return res.data;
  }

  // --------- Cards ---------

  /**
   * POST /cards is *asynchronous* in Sudo. The response is `pending` with no PAN.
   * The full card object (with maskedPan, expiry) arrives later via the `card.created`
   * webhook — typically 30s–4min. Worker waits for this; do not poll in a tight loop.
   */
  async createCard(input: CreateCardInput): Promise<SudoCard> {
    const body = {
      customerId: input.customerId,
      fundingSourceId: input.fundingSourceId,
      type: input.type,
      brand: input.brand,
      currency: input.currency,
      issuerCountry: input.issuerCountry,
      status: input.status ?? 'active',
      spendingControls: input.spendingControls,
    };
    const res = await this.http.post<SudoEnvelope<SudoCard>>('/cards', body);
    return res.data;
  }

  async getCard(id: string): Promise<SudoCard> {
    const res = await this.http.get<SudoEnvelope<SudoCard>>(`/cards/${id}`);
    return res.data;
  }

  async freezeCard(id: string): Promise<SudoCard> {
    const res = await this.http.put<SudoEnvelope<SudoCard>>(`/cards/${id}`, { status: 'inactive' });
    return res.data;
  }

  async unfreezeCard(id: string): Promise<SudoCard> {
    const res = await this.http.put<SudoEnvelope<SudoCard>>(`/cards/${id}`, { status: 'active' });
    return res.data;
  }

  async cancelCard(id: string): Promise<SudoCard> {
    const res = await this.http.put<SudoEnvelope<SudoCard>>(`/cards/${id}`, {
      status: 'cancelled',
    });
    return res.data;
  }

  async getCardToken(id: string): Promise<{ token: string; expiresAt: string }> {
    // PCI-scoped endpoint; token is exchanged for a one-shot PAN reveal iframe URL.
    const res = await this.http.post<SudoEnvelope<{ token: string; expiresAt: string }>>(
      `/cards/${id}/token`,
      {},
    );
    return res.data;
  }

  async updateSpendingControls(
    id: string,
    controls: SudoCard['spendingControls'],
  ): Promise<SudoCard> {
    const res = await this.http.put<SudoEnvelope<SudoCard>>(`/cards/${id}`, {
      spendingControls: controls,
    });
    return res.data;
  }

  // --------- Authorizations & transactions ---------

  async getAuthorization(id: string): Promise<SudoAuthorization> {
    const res = await this.http.get<SudoEnvelope<SudoAuthorization>>(`/cards/authorizations/${id}`);
    return res.data;
  }

  async listAuthorizations(
    cardId: string,
    opts?: { limit?: number; page?: number; from?: string; to?: string },
  ): Promise<SudoAuthorization[]> {
    const res = await this.http.get<SudoEnvelope<SudoAuthorization[]>>(
      `/cards/${cardId}/authorizations`,
      { query: opts as Record<string, string | number | undefined> },
    );
    return res.data;
  }

  // --------- Funding ---------

  async fundCard(cardId: string, amount: number, currency: string): Promise<void> {
    // Sudo expects amount in MAJOR units (NGN, not kobo). Caller must convert.
    await this.http.post(`/cards/${cardId}/fund`, { amount, currency });
  }
}
