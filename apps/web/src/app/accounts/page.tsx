import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Accounts() {
  const rows = await prisma.account.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Accounts</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Type</th>
            <th>Currency</th>
            <th>Provider</th>
            <th>Available</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-fayapay-100">
              <td className="py-2 font-mono text-xs">{a.type}</td>
              <td>{a.currency}</td>
              <td className="font-mono text-xs">{a.externalProvider ?? '—'}</td>
              <td className="font-mono">{a.availableBalance.toString()}</td>
              <td>{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
