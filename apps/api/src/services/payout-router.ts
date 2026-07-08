import { PayoutProvider } from '@fayapay/db';
import { ValidationError } from '@fayapay/shared';

/**
 * Select the payout provider for a given currency.
 *
 *  NGN: Paystack (primary), Flutterwave fallback.
 *  KES, GHS, ZAR, UGX: Flutterwave.
 *  USD: Wise.
 *  EUR: Wise primary, Currencycloud fallback.
 *  GBP: Modulr (Faster Payments) primary, Wise fallback.
 */
export function selectPayoutProvider(input: {
  currency: string;
  destinationCountry?: string;
}): PayoutProvider {
  switch (input.currency) {
    case 'NGN':
      return 'PAYSTACK';
    case 'KES':
    case 'GHS':
    case 'ZAR':
    case 'UGX':
    case 'TZS':
    case 'RWF':
      return 'FLUTTERWAVE';
    case 'USD':
      return 'WISE';
    case 'EUR':
      return 'WISE';
    case 'GBP':
      return input.destinationCountry === 'GB' ? 'MODULR' : 'WISE';
    default:
      throw new ValidationError(`No payout provider for ${input.currency}`);
  }
}
