import { prisma, WebhookEvent } from '@fayapay/db';
import { logger } from '@fayapay/shared';

export async function handleWise(ev: WebhookEvent) {
  const payload = ev.payload as unknown as {
    event_type: string;
    data: { resource: { type: string; id: number; profile_id: number }; current_state?: string };
  };

  if (payload.event_type === 'transfers#state-change' && payload.data.resource.type === 'transfer') {
    const wiseId = String(payload.data.resource.id);
    const payout = await prisma.payout.findFirst({
      where: { provider: 'WISE', providerPayoutId: wiseId },
    });
    if (!payout) {
      logger.warn({ wiseId }, 'wise state change for unknown transfer');
      return;
    }
    const state = payload.data.current_state;
    const status =
      state === 'outgoing_payment_sent'
        ? 'COMPLETED'
        : state === 'cancelled' || state === 'funds_refunded'
          ? 'FAILED'
          : state === 'bounced_back'
            ? 'RETURNED'
            : 'PROCESSING';
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
  }
}
