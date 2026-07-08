import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Transactions() {
  const rows = await prisma.cardTransaction.findMany({
    orderBy: { postedAt: 'desc' },
    take: 200,
    include: { card: { include: { cardholder: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Card transactions</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Posted</th>
            <th>Cardholder</th>
            <th>Merchant</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-fayapay-100">
              <td className="py-2 text-xs">{t.postedAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td>
                {t.card.cardholder.firstName} {t.card.cardholder.lastName}
              </td>
              <td>{t.merchantName ?? '—'}</td>
              <td className="font-mono">
                {(Number(t.amount) / 100).toFixed(2)} {t.currency}
              </td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
