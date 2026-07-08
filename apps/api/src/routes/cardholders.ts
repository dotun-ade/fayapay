import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { NotFoundError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';
import { dispatchKyc } from '../services/kyc-router.js';

const createSchema = z.object({
  externalRef: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(7),
  dateOfBirth: z.string(),
  country: z.string().length(2),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  identification: z
    .object({
      type: z.enum(['BVN', 'NIN', 'PASSPORT', 'DRIVERS_LICENSE']),
      number: z.string(),
    })
    .optional(),
});

export const cardholderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireApiKey);

  app.post('/', async (req) => {
    const body = createSchema.parse(req.body);
    const cardholder = await prisma.cardholder.create({
      data: {
        businessId: req.businessId!,
        externalRef: body.externalRef,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: new Date(body.dateOfBirth),
        country: body.country.toUpperCase(),
        addressLine1: body.addressLine1,
        city: body.city,
        region: body.region,
        postalCode: body.postalCode,
        kycStatus: 'PENDING',
      },
    });
    if (body.identification) {
      await dispatchKyc({
        cardholderId: cardholder.id,
        country: cardholder.country,
        identification: body.identification,
        queue: app.queues.kycPolling,
      });
    }
    return cardholder;
  });

  app.get('/', async (req) => {
    const { page = '1', limit = '50' } = (req.query ?? {}) as Record<string, string>;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const [data, total] = await Promise.all([
      prisma.cardholder.findMany({
        where: { businessId: req.businessId! },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.cardholder.count({ where: { businessId: req.businessId! } }),
    ]);
    return { data, total, page: Number(page), limit: take };
  });

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const cardholder = await prisma.cardholder.findFirst({
      where: { id, businessId: req.businessId! },
      include: { cards: true, accounts: true, kycRecords: true },
    });
    if (!cardholder) throw new NotFoundError('Cardholder', id);
    return cardholder;
  });
};
