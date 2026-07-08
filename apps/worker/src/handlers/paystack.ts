import { prisma, WebhookEvent } from '@fayapay/db';
import { post as ledgerPost } from '@fayapay/ledger';
import { logger } from '@fayapay/shared';

export async function handlePaystack(ev: WebhookEvent) {
  const payload = ev.payload as unknown as { event: string; data: Record<string, unknown> };

  if (payload.event === 'charge.success') {
    const ref = String(payload.data['reference']);
    const collection = await prisma.collection.findUnique({
      where: { provider_providerRef: { provider: 'PAYSTACK', providerRef: ref } },
    });
    if (!collection) {
      logger.warn({ ref }, 'paystack charge.success — no matching collection');
      return;
    }
    if (collection.status === 'COMPLETED') return;

    const amount = BigInt(payload.data['amount'] as number); // kobo
    const account = await prisma.account.findUnique({ where: { id: collection.accountId } });
    if (!account) return;

    const settlement = await ensureSettlementAccount(account.businessId, account.currency, 'paystack');
    await ledgerPost({
      type: 'COLLECTION',
      description: `Paystack collection ${ref}`,
      referenceType: 'collection',
      referenceId: collection.id,
      legs: [
        { accountId: settlement.id, direction: 'DEBIT', amount, currency: account.currency },
        { accountId: account.id, direction: 'CREDIT', amount, currency: account.currency },
      ],
    });
    await prisma.collection.update({
      where: { id: collection.id },
      data: { status: 'COMPLETED', receivedAt: new Date(), raw: payload.data as never },
    });
    return;
  }

  if (payload.event === 'transfer.success' || payload.event === 'transfer.failed' || payload.event === 'transfer.reversed') {
    const ref = String(payload.data['reference']);
    const payout = await prisma.payout.findFirst({
      where: { provider: 'PAYSTACK', providerPayoutId: String(payload.data['transfer_code'] ?? '') },
    });
    if (!payout) {
      logger.warn({ ref }, 'paystack transfer webhook — no matching payout');
      return;
    }
    if (payload.event === 'transfer.success') {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } else if (payload.event === 'transfer.reversed') {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: 'RETURNED' } });
    } else {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failureReason: String(payload.data['failure_reason'] ?? 'unknown') },
      });
    }
    return;
  }

  if (payload.event === 'dedicatedaccount.assign.success') {
    // DVA assigned — link to the requesting account via metadata.
    logger.info({ ref: payload.data['customer'] }, 'paystack DVA assigned');
    return;
  }
}

async function ensureSettlementAccount(businessId: string, currency: string, provider: string) {
  const existing = await prisma.account.findFirst({
    where: { businessId, currency, type: 'SETTLEMENT', externalProvider: provider },
  });
  if (existing) return existing;
  return prisma.account.create({
    data: { businessId, type: 'SETTLEMENT', currency, externalProvider: provider },
  });
}
