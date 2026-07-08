import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  { id: 'sudo', name: 'Sudo Africa', role: 'Card issuing — NGN/KES/GHS' },
  { id: 'paystack', name: 'Paystack', role: 'NG collections + transfers' },
  { id: 'flutterwave', name: 'Flutterwave', role: 'Pan-Africa collections + payouts' },
  { id: 'wise', name: 'Wise', role: 'USD/EUR/GBP send + FX' },
  { id: 'currencycloud', name: 'Currencycloud', role: 'GBP/EUR collections + FX' },
  { id: 'modulr', name: 'Modulr', role: 'GBP Faster Payments' },
  { id: 'dojah', name: 'Dojah', role: 'KYC — BVN/NIN/CAC' },
];

export default async function Providers() {
  const grouped = await prisma.webhookEvent.groupBy({
    by: ['provider'],
    _count: { _all: true },
    where: { receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const map = new Map(grouped.map((g) => [g.provider, g._count._all]));
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Provider health</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="bg-white border border-fayapay-100 rounded p-4">
            <div className="flex justify-between items-baseline">
              <div className="font-semibold">{p.name}</div>
              <div className="font-mono text-xs text-fayapay-500">{p.id}</div>
            </div>
            <div className="text-xs text-fayapay-500 mt-1">{p.role}</div>
            <div className="mt-3 text-sm">
              <span className="font-mono">{map.get(p.id) ?? 0}</span> webhook events / 24h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
