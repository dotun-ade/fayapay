import { prisma } from '@fayapay/db';
import { logger } from '@fayapay/shared';
import { SudoClient } from '@fayapay/sudo';
import type { Job } from 'bullmq';

export async function processCardEvent(job: Job<{ cardId: string }>) {
  const card = await prisma.card.findUnique({ where: { id: job.data.cardId } });
  if (!card || !card.providerCardId) return;

  if (job.name === 'freeze' || job.name === 'unfreeze' || job.name === 'cancel') {
    const target =
      job.name === 'freeze' ? 'freeze' : job.name === 'cancel' ? 'cancel' : 'unfreeze';
    try {
      if (card.provider !== 'SUDO') {
        logger.warn(
          { cardId: card.id, provider: card.provider },
          'card op on unsupported provider',
        );
        return;
      }
      const c = new SudoClient();
      if (target === 'freeze') await c.freezeCard(card.providerCardId);
      else if (target === 'cancel') await c.cancelCard(card.providerCardId);
      else await c.unfreezeCard(card.providerCardId);
    } catch (err) {
      logger.error({ err, cardId: card.id, op: target }, 'card op failed');
      throw err;
    }
  }
}
