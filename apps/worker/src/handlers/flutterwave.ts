import { prisma, WebhookEvent } from '@fayapay/db';
import { logger } from '@fayapay/shared';

export async function handleFlutterwave(ev: WebhookEvent) {
  const payload = ev.payload as unknown as { event: string; data: Record<string, unknown> };

  if (payload.event === 'charge.completed') {
    const ref = String(payload.data['tx_ref']);
    const collection = await prisma.collection.findUnique({
      where: { provider_providerRef: { provider: 'FLUTTERWAVE', providerRef: ref } },
    });
    if (!collection) {
      logger.warn({ ref }, 'flutterwave charge.completed — unknown ref');
      return;
    }
    await prisma.collection.update({
      where: { id: collection.id },
      data: {
        status: payload.data['status'] === 'successful' ? 'COMPLETED' : 'FAILED',
        receivedAt: new Date(),
        raw: payload.data as never,
      },
    });
    return;
  }

  if (payload.event === 'transfer.completed') {
    const ref = String(payload.data['reference']);
    const payout = await prisma.payout.findFirst({
      where: { provider: 'FLUTTERWAVE', providerPayoutId: String(payload.data['id']) },
    });
    if (!payout) {
      logger.warn({ ref }, 'flutterwave transfer.completed — unknown id');
      return;
    }
    const status = String(payload.data['status']);
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: status === 'SUCCESSFUL' ? 'COMPLETED' : 'FAILED',
        completedAt: status === 'SUCCESSFUL' ? new Date() : null,
        failureReason: status === 'SUCCESSFUL' ? null : String(payload.data['complete_message'] ?? ''),
      },
    });
  }
}
