import { prisma, Cardholder, Card } from '@fayapay/db';
import { boolEnv, ValidationError } from '@fayapay/shared';
import { SudoClient } from '@fayapay/sudo';
import type { Queue } from 'bullmq';

interface IssueInput {
  businessId: string;
  cardholder: Cardholder;
  input: {
    type: 'VIRTUAL' | 'PHYSICAL';
    brand: 'VISA' | 'MASTERCARD' | 'VERVE';
    currency: 'NGN' | 'KES' | 'GHS';
    nameOnCard: string;
    accountId?: string;
    shippingAddress?: {
      line1: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
    };
    spendingControls?: Record<string, unknown>;
  };
  cardEventsQueue: Queue;
}

/**
 * Issue a card. Sudo Africa is the only configured issuer — NGN, KES, GHS.
 * Other currencies are not supported until a partner is signed.
 *
 * Sudo's POST /cards is asynchronous: response is `pending` with no PAN.
 * The full card object arrives via the `card.created` webhook, typically
 * 30s–4min later. Worker watches for it; do not block on the API path.
 */
export async function issueCard(input: IssueInput): Promise<Card> {
  ensureSudoEnabled();
  if (!['NGN', 'KES', 'GHS'].includes(input.input.currency)) {
    throw new ValidationError(
      `No issuer configured for currency ${input.input.currency}. Fayapay currently issues NGN, KES, GHS via Sudo Africa.`,
    );
  }

  const account =
    input.input.accountId ??
    (await ensureCardFundingAccount(input.businessId, input.cardholder.id, input.input.currency));

  const card = await prisma.card.create({
    data: {
      businessId: input.businessId,
      cardholderId: input.cardholder.id,
      accountId: account,
      provider: 'SUDO',
      brand: input.input.brand,
      type: input.input.type,
      currency: input.input.currency,
      nameOnCard: input.input.nameOnCard,
      status: 'PENDING',
      shippingAddress: input.input.shippingAddress
        ? {
            line1: input.input.shippingAddress.line1,
            city: input.input.shippingAddress.city,
            region: input.input.shippingAddress.region,
            postalCode: input.input.shippingAddress.postalCode,
            country: input.input.shippingAddress.country,
          }
        : undefined,
      spendingControls: input.input.spendingControls
        ? (input.input.spendingControls as Record<string, unknown>)
        : undefined,
    },
  });

  await callSudo(card, input.cardholder).catch((err) => {
    input.cardEventsQueue.add('retry-issue', { cardId: card.id, err: String(err) });
  });

  return card;
}

function ensureSudoEnabled() {
  if (!boolEnv('FEATURE_SUDO_PRIMARY_NG', true)) {
    throw new ValidationError('Card issuance temporarily disabled');
  }
}

async function ensureCardFundingAccount(businessId: string, cardholderId: string, currency: string) {
  const existing = await prisma.account.findFirst({
    where: { businessId, cardholderId, currency, type: 'CARD_FUNDING' },
  });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: { businessId, cardholderId, type: 'CARD_FUNDING', currency },
  });
  return created.id;
}

async function callSudo(card: Card, cardholder: Cardholder) {
  const sudo = new SudoClient();
  const sudoCustomerId =
    (cardholder.metadata && typeof cardholder.metadata === 'object'
      ? (cardholder.metadata as Record<string, string>).sudoCustomerId
      : undefined) ?? '';
  const remote = await sudo.createCard({
    customerId: sudoCustomerId,
    fundingSourceId: process.env.SUDO_DEFAULT_FUNDING_SOURCE_ID ?? '',
    type: card.type === 'PHYSICAL' ? 'physical' : 'virtual',
    brand: card.brand === 'VERVE' ? 'Verve' : card.brand === 'MASTERCARD' ? 'MasterCard' : 'Visa',
    currency: card.currency as 'NGN' | 'KES' | 'GHS',
  });
  await prisma.card.update({
    where: { id: card.id },
    data: { providerCardId: remote._id },
  });
}
