// Wise (TransferWise) API. We use v1 + v2 endpoints depending on resource.
// Money is in MAJOR units (decimal numbers in JSON). Profiles have an integer id.

export interface WiseProfile {
  id: number;
  type: 'PERSONAL' | 'BUSINESS';
  details: Record<string, unknown>;
}

export interface WiseBalance {
  id: number;
  currency: string;
  type: 'STANDARD' | 'SAVINGS' | 'JAR';
  name?: string;
  amount: { value: number; currency: string };
  reservedAmount: { value: number; currency: string };
  cashAmount?: { value: number; currency: string };
  totalWorth?: { value: number; currency: string };
  creationTime: string;
  modificationTime: string;
  visible: boolean;
}

export interface WiseQuote {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  payOut: 'BANK_TRANSFER' | 'BALANCE' | 'SWIFT';
  rate: number;
  fee: number;
  fees: { transferwise: number; payIn: number; discount: number; total: number };
  expirationTime: string;
  status: 'PENDING' | 'ACCEPTED' | 'FUNDED' | 'EXPIRED';
}

export interface WiseRecipient {
  id: number;
  business?: number;
  profile: number;
  accountHolderName: string;
  currency: string;
  country?: string;
  type: string;
  details: Record<string, unknown>;
}

export interface WiseTransfer {
  id: number;
  user: number;
  targetAccount: number;
  sourceAccount?: number;
  quote: string;
  quoteUuid: string;
  status:
    | 'incoming_payment_waiting'
    | 'processing'
    | 'funds_converted'
    | 'outgoing_payment_sent'
    | 'cancelled'
    | 'funds_refunded'
    | 'bounced_back';
  reference?: string;
  rate: number;
  created: string;
  business?: number;
  transferRequest?: number;
  details?: { reference: string };
  hasActiveIssues: boolean;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  customerTransactionId?: string;
}

export interface WiseWebhookPayload {
  data: {
    resource: { type: 'transfer' | 'balance-account'; id: number; profile_id: number };
    current_state?: string;
    previous_state?: string;
    occurred_at?: string;
  };
  subscription_id: string;
  event_type: string;
  schema_version: '2.0.0';
  sent_at: string;
}
