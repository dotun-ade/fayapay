import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '@fayapay/db';
import { UnauthorizedError, ValidationError } from '@fayapay/shared';
import type { FastifyPluginAsync } from 'fastify';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  legalName: z.string().min(2),
  country: z.string().length(2),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/signup', async (req, reply) => {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.user.findFirst({ where: { email: body.email } });
    if (existing) throw new ValidationError('Email already in use');

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
    const business = await prisma.business.create({
      data: {
        legalName: body.legalName,
        country: body.country.toUpperCase(),
        status: 'PENDING',
        users: {
          create: {
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName,
            role: 'OWNER',
            passwordHash,
          },
        },
      },
      include: { users: true },
    });
    const user = business.users[0]!;
    const token = await reply.jwtSign({ sub: user.id, businessId: business.id });
    return { token, businessId: business.id, userId: user.id };
  });

  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: body.email } });
    if (!user) throw new UnauthorizedError('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) throw new UnauthorizedError('Invalid credentials');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = await reply.jwtSign({ sub: user.id, businessId: user.businessId });
    return { token, businessId: user.businessId, userId: user.id };
  });

  app.get('/me', { preHandler: app.requireUser }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { business: true },
    });
    return user;
  });
};
