import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [cards, cardholders, payouts, collections, drift] = await Promise.all([
    prisma.card.count(),
    prisma.cardholder.count(),
    prisma.payout.count(),
    prisma.collection.count(),
    prisma.webhookEvent.count({ where: { processedAt: null } }),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Cards" value={cards} />
        <Stat label="Cardholders" value={cardholders} />
        <Stat label="Payouts" value={payouts} />
        <Stat label="Collections" value={collections} />
        <Stat label="Unprocessed webhooks" value={drift} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-fayapay-100 rounded p-4">
      <div className="text-xs uppercase text-fayapay-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
