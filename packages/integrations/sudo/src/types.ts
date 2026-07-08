// Sudo Africa API types — partial. We mirror what we use, not the whole surface.
// Reference: https://docs.sudo.africa/reference

export interface SudoEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface SudoCustomer {
  _id: string;
  type: 'individual' | 'company';
  name: string;
  phoneNumber: string;
  emailAddress: string;
  individual?: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    dob: string;
    identity?: {
      type: 'BVN' | 'NIN' | 'PASSPORT' | 'DRIVERS_LICENSE';
      number: string;
    };
  };
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SudoCard {
  _id: string;
  business: string;
  customer: string;
  account: string;
  fundingSource: string;
  type: 'physical' | 'virtual';
  brand: 'Verve' | 'MasterCard' | 'Visa';
  currency: 'NGN' | 'USD' | 'KES' | 'GHS';
  maskedPan: string;
  expiryMonth: string;
  expiryYear: string;
  status: 'active' | 'inactive' | 'cancelled' | 'pending';
  spendingControls?: {
    channels?: {
      atm: boolean;
      pos: boolean;
      web: boolean;
      mobile: boolean;
    };
    allowedCategories?: string[];
    blockedCategories?: string[];
    spendingLimits?: Array<{
      amount: number;
      interval: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime';
      categories?: string[];
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SudoAuthorization {
  _id: string;
  business: string;
  card: string;
  customer: string;
  status: 'approved' | 'declined' | 'pending' | 'reversed';
  amount: number;
  currency: string;
  approvedAmount: number;
  pendingRequest?: {
    amount: number;
    currency: string;
    merchant: {
      name: string;
      city: string;
      state?: string;
      country: string;
      postalCode?: string;
      merchantCategoryCode: string;
    };
  };
  merchant?: {
    name: string;
    city: string;
    country: string;
    merchantCategoryCode: string;
  };
  transactionMetadata?: {
    type: 'authorization' | 'reversal' | 'refund' | 'funding';
    method: 'pos' | 'web' | 'atm' | 'mobile' | 'manual';
  };
  feeDetails?: {
    type: string;
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  type: 'individual';
  name: string;
  phoneNumber: string;
  emailAddress: string;
  individual: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    dob: string;
    identity: {
      type: 'BVN' | 'NIN';
      number: string;
    };
  };
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  status?: 'active';
}

export interface CreateCardInput {
  customerId: string;
  fundingSourceId: string;
  type: 'physical' | 'virtual';
  brand: 'Verve' | 'MasterCard' | 'Visa';
  currency: 'NGN' | 'USD' | 'KES' | 'GHS';
  issuerCountry?: 'NGA' | 'KEN' | 'GHA';
  status?: 'active';
  spendingControls?: SudoCard['spendingControls'];
}

export type SudoWebhookEventType =
  | 'card.created'
  | 'card.updated'
  | 'card.balance.updated'
  | 'authorization.created'
  | 'authorization.updated'
  | 'transaction.created'
  | 'transaction.updated'
  | 'customer.created'
  | 'customer.updated';

export interface SudoWebhookEvent<T = unknown> {
  type: SudoWebhookEventType;
  data: { object: T };
  businessId: string;
  createdAt: string;
}
