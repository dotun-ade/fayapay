import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Cards() {
  const rows = await prisma.card.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { cardholder: true },
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Cards</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Cardholder</th>
            <th>Provider</th>
            <th>Brand</th>
            <th>Currency</th>
            <th>Last4</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-fayapay-100">
              <td className="py-2">
                {c.cardholder.firstName} {c.cardholder.lastName}
              </td>
              <td className="font-mono text-xs">{c.provider}</td>
              <td>{c.brand}</td>
              <td>{c.currency}</td>
              <td className="font-mono">•••• {c.last4 ?? '----'}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
