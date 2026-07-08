// Paystack — Nigeria collections + transfers. Money is in KOBO (minor units).
// Reference: https://paystack.com/docs/api

export interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
  meta?: { total: number; perPage: number; page: number; pageCount: number };
}

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  risk_action: 'default' | 'allow' | 'deny';
  international_format_phone?: string;
  identification?: { country: string; type: 'bvn' | 'bank_account'; value: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway?: string | null;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: 'nuban' | 'mobile_money' | 'ghipss' | 'other';
}

export interface PaystackTransaction {
  id: number;
  domain: 'live' | 'test';
  status: 'success' | 'failed' | 'abandoned' | 'reversed' | 'pending';
  reference: string;
  amount: number; // kobo
  message?: string;
  gateway_response?: string;
  paid_at?: string;
  created_at: string;
  channel: string;
  currency: string;
  fees: number;
  customer: { id: number; customer_code: string; email: string };
  authorization?: {
    authorization_code: string;
    bin: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    card_type: string;
    bank: string;
    country_code: string;
    brand: string;
    reusable: boolean;
    signature: string;
  };
}

export interface PaystackTransfer {
  id: number;
  domain: 'live' | 'test';
  amount: number; // kobo
  currency: 'NGN' | 'GHS' | 'ZAR';
  source: 'balance';
  reason?: string;
  recipient: number;
  status: 'pending' | 'success' | 'failed' | 'reversed' | 'otp';
  transfer_code: string;
  reference: string;
  failure_reason?: string;
  createdAt: string;
}

export interface PaystackTransferRecipient {
  id: number;
  recipient_code: string;
  type: 'nuban' | 'mobile_money' | 'ghipss' | 'authorization' | 'basa';
  currency: string;
  name: string;
  details: {
    account_number: string;
    account_name?: string;
    bank_code: string;
    bank_name: string;
  };
}

export type PaystackWebhookEventType =
  | 'charge.success'
  | 'charge.failed'
  | 'charge.dispute.create'
  | 'transfer.success'
  | 'transfer.failed'
  | 'transfer.reversed'
  | 'customeridentification.success'
  | 'customeridentification.failed'
  | 'dedicatedaccount.assign.success'
  | 'dedicatedaccount.assign.failed'
  | 'refund.processed'
  | 'refund.failed';

export interface PaystackWebhookEvent<T = unknown> {
  event: PaystackWebhookEventType;
  data: T;
}
