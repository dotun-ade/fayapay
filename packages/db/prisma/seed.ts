import argon2 from 'argon2';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { prisma } from '../src/index.js';

async function main() {
  console.log('seeding…');

  const passwordHash = await argon2.hash('password123!', { type: argon2.argon2id });

  const business = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      legalName: 'Fayapay Test Co. Ltd',
      tradingName: 'Fayapay Test',
      country: 'NG',
      status: 'ACTIVE',
      kybTier: 2,
      supportEmail: 'support@fayapay.test',
      users: {
        create: {
          email: 'owner@fayapay.test',
          firstName: 'Ada',
          lastName: 'Owner',
          role: 'OWNER',
          passwordHash,
        },
      },
    },
    update: {},
  });

  // API key
  const rawKey = `sk_test_${randomBytes(24).toString('hex')}`;
  const prefix = rawKey.split('_').slice(0, 3).join('_');
  await prisma.apiKey.upsert({
    where: { keyPrefix: prefix },
    create: {
      businessId: business.id,
      name: 'Local dev',
      keyPrefix: prefix,
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      scopes: ['*'],
    },
    update: {},
  });
  console.log(`  API key (save this): ${rawKey}`);

  // Cardholders + accounts + cards
  const seedHolders = [
    { firstName: 'Tunde', lastName: 'Adesanya', country: 'NG', currency: 'NGN', kyc: 'APPROVED' as const },
    { firstName: 'Wanjiku', lastName: 'Kimani', country: 'KE', currency: 'KES', kyc: 'APPROVED' as const },
    { firstName: 'Kwame', lastName: 'Mensah', country: 'GH', currency: 'GHS', kyc: 'APPROVED' as const },
    { firstName: 'Lerato', lastName: 'Khumalo', country: 'ZA', currency: 'ZAR', kyc: 'IN_REVIEW' as const },
    { firstName: 'Mireille', lastName: 'Diop', country: 'NG', currency: 'NGN', kyc: 'IN_REVIEW' as const },
    { firstName: 'James', lastName: 'Okafor', country: 'NG', currency: 'NGN', kyc: 'PENDING' as const },
  ];

  for (const sh of seedHolders) {
    const cardholder = await prisma.cardholder.create({
      data: {
        businessId: business.id,
        firstName: sh.firstName,
        lastName: sh.lastName,
        email: `${sh.firstName}.${sh.lastName}@fayapay.test`.toLowerCase(),
        phone: '+2348000000000',
        dateOfBirth: new Date('1990-01-01'),
        country: sh.country,
        kycStatus: sh.kyc,
        kycTier: sh.kyc === 'APPROVED' ? 1 : 0,
      },
    });
    const account = await prisma.account.create({
      data: {
        businessId: business.id,
        cardholderId: cardholder.id,
        type: 'WALLET',
        currency: sh.currency,
        availableBalance: BigInt(50_000_00),
      },
    });
    if (sh.kyc === 'APPROVED' && ['NGN', 'KES', 'GHS'].includes(sh.currency)) {
      await prisma.card.create({
        data: {
          businessId: business.id,
          cardholderId: cardholder.id,
          accountId: account.id,
          provider: 'SUDO',
          providerCardId: `seed_${randomUUID().slice(0, 12)}`,
          brand: 'VISA',
          type: 'VIRTUAL',
          currency: sh.currency,
          nameOnCard: `${sh.firstName} ${sh.lastName}`,
          last4: String(Math.floor(1000 + Math.random() * 9000)),
          expMonth: 12,
          expYear: 2028,
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });
    }
  }

  // Settlement accounts for each currency × provider
  for (const provider of ['sudo', 'paystack', 'flutterwave', 'wise', 'modulr', 'currencycloud']) {
    for (const currency of ['NGN', 'KES', 'GHS', 'ZAR', 'USD', 'EUR', 'GBP']) {
      const exists = await prisma.account.findFirst({
        where: { businessId: business.id, externalProvider: provider, currency, type: 'SETTLEMENT' },
      });
      if (!exists) {
        await prisma.account.create({
          data: {
            businessId: business.id,
            type: 'SETTLEMENT',
            currency,
            externalProvider: provider,
            availableBalance: BigInt(10_000_000),
          },
        });
      }
    }
  }

  console.log('done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
