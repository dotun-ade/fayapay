// Dojah API — Nigerian identity (BVN, NIN, CAC).
// Reference: https://docs.dojah.io

export interface DojahEnvelope<T> {
  entity: T;
}

export interface DojahBvnRecord {
  bvn: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: string;
  phone_number1?: string;
  phone_number2?: string;
  enrollment_branch?: string;
  enrollment_bank?: string;
  gender?: 'Male' | 'Female';
  marital_status?: string;
  email?: string;
  image?: string; // base64
}

export interface DojahNinRecord {
  nin: string;
  firstname: string;
  middlename?: string;
  surname: string;
  birthdate: string;
  gender?: string;
  phone?: string;
  email?: string;
  residence_state?: string;
  residence_lga?: string;
  picture?: string;
}

export interface DojahCacRecord {
  rc_number: string;
  company_name: string;
  date_of_registration: string;
  company_type: string;
  status: string;
  address?: string;
  email?: string;
  phone_number?: string;
  directors?: Array<{ name: string; designation: string }>;
}

export interface DojahWebhookEvent<T = unknown> {
  event: 'kyc.completed' | 'kyc.failed' | 'identity.verified' | string;
  reference: string;
  data: T;
  timestamp: string;
}
