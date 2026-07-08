// Modulr API. Money is in MAJOR units (decimal, two places). GBP + EUR.
// Reference: https://api-docs.modulrfinance.com

export interface ModulrCustomer {
  id: string;
  externalReference?: string;
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'VERIFIED' | 'OUTREACH' | 'EXITED';
  type: 'INDIVIDUAL' | 'LLC' | 'PLC' | 'CHARITY' | 'PARTNRSHP' | 'SOLETRADER';
  name?: string;
  companiesHouseNumber?: string;
  registeredAddress?: ModulrAddress;
  tradingAddress?: ModulrAddress;
  expectedMonthlySpend?: number;
  associates?: Array<{
    type: 'DIRECTOR' | 'PSC' | 'PARTNER' | 'SHAREHOLDER';
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    homeAddress: ModulrAddress;
    nationality?: string;
  }>;
  created: string;
}

export interface ModulrAddress {
  addressLine1: string;
  addressLine2?: string;
  postTown: string;
  postCode: string;
  country: string;
}

export interface ModulrAccount {
  id: string;
  name?: string;
  status: 'ACTIVE' | 'CLOSED' | 'BLOCKED' | 'QUARANTINED';
  balance: number;
  availableBalance: number;
  currency: 'GBP' | 'EUR';
  customerId: string;
  identifiers: Array<{
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    bic?: string;
    type: 'SCAN' | 'IBAN';
  }>;
  directDebit: boolean;
  created: string;
}

export interface ModulrPayment {
  id: string;
  externalReference?: string;
  status: 'SUBMITTED' | 'VALIDATED' | 'PROCESSED' | 'REJECTED' | 'RETURNED' | 'EXPIRED';
  approvalStatus?: 'REQUIRED' | 'APPROVED' | 'REJECTED' | 'NOTREQUIRED';
  type: 'PAYOUT' | 'PAYIN';
  amount: number;
  currency: 'GBP' | 'EUR';
  sourceAccountId: string;
  destination: {
    type: 'BENEFICIARY' | 'ACCOUNT' | 'SCAN' | 'IBAN';
    id?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    bic?: string;
    name?: string;
  };
  reference: string;
  rejectionReason?: string;
  created: string;
}

export interface ModulrBeneficiary {
  id: string;
  name: string;
  customerId: string;
  destinationIdentifier: { type: 'SCAN' | 'IBAN'; accountNumber?: string; sortCode?: string; iban?: string; bic?: string };
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  created: string;
}

export interface ModulrWebhookEvent {
  type: 'PAYMENT' | 'TRANSACTION' | 'ACCOUNT';
  content: Record<string, unknown>;
}
