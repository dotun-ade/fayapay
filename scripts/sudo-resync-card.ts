#!/usr/bin/env tsx
/**
 * Resync a Fayapay card's local state from Sudo.
 *
 * Use when the `card.created` webhook never arrived. See:
 *   docs/runbooks/sudo-card-stuck-pending.md
 *
 * Usage:
 *   pnpm tsx scripts/sudo-resync-card.ts <card_id>
 */
import { prisma } from '@fayapay/db';
import { SudoClient } from '@fayapay/sudo';

async function main() {
  const [, , cardId] = process.argv;
  if (!cardId) {
    console.error('usage: sudo-resync-card.ts <card_id>');
    process.exit(2);
  }
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || card.provider !== 'SUDO' || !card.providerCardId) {
    console.error('not a Sudo card or missing providerCardId');
    process.exit(2);
  }
  const sudo = new SudoClient();
  const remote = await sudo.getCard(card.providerCardId);
  await prisma.card.update({
    where: { id: card.id },
    data: {
      last4: remote.maskedPan.slice(-4),
      expMonth: Number(remote.expiryMonth),
      expYear: Number(remote.expiryYear),
      status: remote.status === 'active' ? 'ACTIVE' : card.status,
      activatedAt: remote.status === 'active' && !card.activatedAt ? new Date() : card.activatedAt,
    },
  });
  console.log(`resynced ${card.id} (sudo ${remote._id}) — status=${remote.status}, last4=${remote.maskedPan.slice(-4)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
