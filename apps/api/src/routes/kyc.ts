import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { dispatchKyc } from '../services/kyc-router.js';

const submitSchema = z.object({
  cardholderId: z.string().uuid(),
  identification: z.object({
    type: z.enum(['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENSE']),
    number: z.string(),
  }),
  selfie: z.string().optional(), // base64
});

export const kycRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/submit', async (req) => {
    const body = submitSchema.parse(req.body);
    const cardholder = await prisma.cardholder.findFirst({
      where: { id: body.cardholderId, businessId: req.businessId! },
    });
    if (!cardholder) throw new NotFoundError('Cardholder', body.cardholderId);

    return dispatchKyc({
      cardholderId: cardholder.id,
      country: cardholder.country,
      identification: body.identification,
      selfieBase64: body.selfie,
      queue: app.queues.kycPolling,
    });
  });

  app.get('/cardholders/:id', async (req) => {
    const { id } = req.params as { id: string };
    const cardholder = await prisma.cardholder.findFirst({
      where: { id, businessId: req.businessId! },
      include: { kycRecords: true },
    });
    if (!cardholder) throw new NotFoundError('Cardholder', id);
    return { kycStatus: cardholder.kycStatus, records: cardholder.kycRecords };
  });
};
