import { prisma, WebhookEvent } from '@fayapay/db';
import { post as ledgerPost } from '@fayapay/ledger';
import { logger } from '@fayapay/shared';

type SudoEnvelope = {
  type: string;
  data: { object: Record<string, unknown> };
  businessId: string;
  createdAt: string;
};

export async function handleSudo(ev: WebhookEvent) {
  const payload = ev.payload as unknown as SudoEnvelope;
  const obj = payload.data.object as Record<string, unknown>;

  switch (payload.type) {
    case 'card.created':
    case 'card.updated': {
      const providerCardId = String(obj['_id']);
      const card = await prisma.card.findUnique({
        where: { provider_providerCardId: { provider: 'SUDO', providerCardId } },
      });
      if (!card) {
        logger.warn({ providerCardId }, 'sudo card webhook for unknown card');
        return;
      }
      await prisma.card.update({
        where: { id: card.id },
        data: {
          last4: String(obj['maskedPan'] ?? '').slice(-4) || undefined,
          expMonth: obj['expiryMonth'] ? Number(obj['expiryMonth']) : undefined,
          expYear: obj['expiryYear'] ? Number(obj['expiryYear']) : undefined,
          status: obj['status'] === 'active' ? 'ACTIVE' : card.status,
          activatedAt: obj['status'] === 'active' && !card.activatedAt ? new Date() : card.activatedAt,
        },
      });
      return;
    }
    case 'authorization.created':
    case 'authorization.updated': {
      const providerCardId = String(obj['card']);
      const card = await prisma.card.findUnique({
        where: { provider_providerCardId: { provider: 'SUDO', providerCardId } },
      });
      if (!card) return;
      const amount = BigInt(Math.round(Number(obj['amount']) * 100));
      const currency = String(obj['currency']);
      const status = String(obj['status']);
      const txGroupId = await ledgerPost({
        type: status === 'reversed' ? 'CARD_AUTH_REVERSAL' : 'CARD_AUTH',
        description: `Auth ${providerCardId}`,
        referenceType: 'sudo_auth',
        referenceId: String(obj['_id']),
        legs: [
          {
            accountId: card.accountId,
            direction: status === 'reversed' ? 'CREDIT' : 'DEBIT',
            amount,
            currency,
          },
          {
            accountId: await reserveAccount(card.businessId, currency),
            direction: status === 'reversed' ? 'DEBIT' : 'CREDIT',
            amount,
            currency,
          },
        ],
      });
      await prisma.cardAuthorization.upsert({
        where: { cardId_providerAuthId: { cardId: card.id, providerAuthId: String(obj['_id']) } },
        create: {
          cardId: card.id,
          providerAuthId: String(obj['_id']),
          amount,
          currency,
          merchantName: ((obj['merchant'] as Record<string, string> | undefined)?.['name']) ?? undefined,
          decision: status === 'approved' ? 'APPROVED' : 'DECLINED',
          declineReason: status !== 'approved' ? String(obj['responseCode'] ?? '') : undefined,
          raw: obj as never,
        },
        update: {
          decision: status === 'approved' ? 'APPROVED' : 'DECLINED',
          raw: obj as never,
        },
      });
      logger.debug({ txGroupId, cardId: card.id }, 'sudo auth posted');
      return;
    }
    case 'transaction.created':
    case 'transaction.updated':
      // Settlement records. Lighter-touch — record only.
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: { lastError: null },
      });
      return;
  }
}

async function reserveAccount(businessId: string, currency: string): Promise<string> {
  const existing = await prisma.account.findFirst({
    where: { businessId, currency, type: 'SETTLEMENT', externalProvider: 'sudo' },
  });
  if (existing) return existing.id;
  const created = await prisma.account.create({
    data: { businessId, type: 'SETTLEMENT', currency, externalProvider: 'sudo' },
  });
  return created.id;
}
