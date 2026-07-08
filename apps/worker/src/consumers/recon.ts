import { reconcileAllAccounts } from '@fayapay/ledger';
import { logger } from '@fayapay/shared';
import type { Job } from 'bullmq';

export async function processRecon(_job: Job) {
  const drift = await reconcileAllAccounts();
  if (drift.length === 0) {
    logger.info('recon clean');
    return;
  }
  for (const d of drift) {
    logger.warn(
      {
        accountId: d.accountId,
        denorm: d.denorm.toString(),
        truth: d.truth.toString(),
        drift: d.drift.toString(),
      },
      'recon drift',
    );
  }
  // TODO(recon): page on-call when any |drift| > 10_000n minor units, per ADR-0011.
}
