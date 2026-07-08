import type { LedgerType } from '@fayapay/db';

export interface Leg {
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: bigint;
  currency: string;
}

export interface PostInput {
  txGroupId?: string;
  type: LedgerType;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  legs: Leg[];
  metadata?: Record<string, unknown>;
}

export interface ReverseInput {
  txGroupId: string;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}
