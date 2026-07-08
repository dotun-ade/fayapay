// Flutterwave v3 — pan-Africa collections & payouts. Amounts are MAJOR units
// (NGN, not kobo). Yes, this differs from Paystack. We convert at the boundary.
// Reference: https://developer.flutterwave.com/v3.0/reference

export interface FlwEnvelope<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
  meta?: { page_info: { total: number; current_page: number; total_pages: number } };
}

export interface FlwCharge {
  id: number;
  tx_ref: string;
  flw_ref: string;
  device_fingerprint?: string;
  amount: number; // major
  charged_amount: number;
  app_fee: number;
  merchant_fee: number;
  processor_response: string;
  auth_model: string;
  currency: string;
  ip: string;
  narration: string;
  status: 'successful' | 'failed' | 'pending';
  payment_type: 'card' | 'bank_transfer' | 'ussd' | 'mobilemoneyzm' | 'mobilemoneyrw' | 'account' | 'mpesa';
  created_at: string;
  account_id: number;
  customer: { id: number; email: string; phone_number?: string; name: string; created_at: string };
  card?: {
    first_6digits: string;
    last_4digits: string;
    issuer: string;
    country: string;
    type: string;
    expiry: string;
  };
}

export interface FlwTransfer {
  id: number;
  account_number: string;
  bank_code: string;
  full_name: string;
  created_at: string;
  currency: string;
  debit_currency?: string;
  amount: number;
  fee: number;
  status: 'NEW' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  reference: string;
  meta?: Record<string, unknown>;
  narration: string;
  complete_message?: string;
  requires_approval?: 0 | 1;
  is_approved?: 0 | 1;
  bank_name: string;
}

export interface FlwVirtualAccount {
  response_code: string;
  response_message: string;
  flw_ref: string;
  order_ref: string;
  account_number: string;
  frequency: string;
  bank_name: string;
  created_at: string;
  expiry_date: string;
  note: string;
  amount: string | null;
}

export interface FlwBank {
  id: number;
  code: string;
  name: string;
}

export interface FlwWebhookEvent<T = unknown> {
  event: 'charge.completed' | 'transfer.completed' | 'subscription.cancelled' | string;
  'event.type'?: string;
  data: T;
}
