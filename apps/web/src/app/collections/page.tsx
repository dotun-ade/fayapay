import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Collections() {
  const rows = await prisma.collection.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Collections</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Created</th>
            <th>Provider</th>
            <th>Method</th>
            <th>Payer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-fayapay-100">
              <td className="py-2 text-xs">{c.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td className="font-mono text-xs">{c.provider}</td>
              <td>{c.method ?? '—'}</td>
              <td>{c.payerEmail ?? c.payerName ?? '—'}</td>
              <td className="font-mono">
                {(Number(c.amount) / 100).toFixed(2)} {c.currency}
              </td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
