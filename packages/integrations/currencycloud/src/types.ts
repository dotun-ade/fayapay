// Currencycloud API types.
// Auth: a session-based auth_token via POST /authenticate/api. Token expires after 30min idle.
// Money is in decimal strings ("1234.56") — not integer minor units. We parse at boundary.

export interface CcAuth {
  auth_token: string;
}

export interface CcAccount {
  id: string;
  account_name: string;
  brand: string;
  legal_entity_type: 'individual' | 'company';
  your_reference?: string;
  status: 'enabled' | 'disabled';
  street?: string;
  city?: string;
  postal_code?: string;
  country: string;
  spread_table?: string;
  created_at: string;
  updated_at: string;
}

export interface CcBalance {
  id: string;
  account_id: string;
  currency: string;
  amount: string;
  created_at: string;
  updated_at: string;
}

export interface CcBeneficiary {
  id: string;
  bank_account_holder_name: string;
  name: string;
  bank_country: string;
  currency: string;
  account_number?: string;
  iban?: string;
  bic_swift?: string;
  bank_name?: string;
  beneficiary_country?: string;
  routing_code_type_1?: string;
  routing_code_value_1?: string;
  payment_types: string[];
}

export interface CcConversion {
  id: string;
  account_id: string;
  buy_currency: string;
  sell_currency: string;
  client_buy_amount: string;
  client_sell_amount: string;
  fixed_side: 'buy' | 'sell';
  mid_market_rate: string;
  client_rate: string;
  status: 'pending' | 'awaiting_funds' | 'completed' | 'cancelled';
  settlement_date: string;
  conversion_date: string;
  short_reference: string;
  created_at: string;
}

export interface CcPayment {
  id: string;
  amount: string;
  beneficiary_id: string;
  currency: string;
  reference: string;
  reason?: string;
  status: 'ready_to_send' | 'released' | 'completed' | 'failed' | 'deleted';
  conversion_id?: string;
  payment_type: 'regular' | 'priority';
  payment_date?: string;
  unique_request_id?: string;
  short_reference: string;
  failure_reason?: string;
  created_at: string;
}

export interface CcFundingAccount {
  id: string;
  account_id: string;
  payment_type: 'regular' | 'priority';
  currency: string;
  bank_account_holder_name: string;
  bank_name: string;
  bank_address: string;
  bank_country: string;
  account_number?: string;
  iban?: string;
  bic_swift?: string;
  routing_code?: string;
}

export interface CcWebhookPayload {
  notification_type: string;
  notification_id: string;
  event_account_id: string;
  event_payload: Record<string, unknown>;
  occurred_at: string;
}
