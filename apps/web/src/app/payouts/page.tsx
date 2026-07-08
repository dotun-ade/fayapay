import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Payouts() {
  const rows = await prisma.payout.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Payouts</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Created</th>
            <th>Provider</th>
            <th>Currency</th>
            <th>Amount</th>
            <th>Beneficiary</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-fayapay-100">
              <td className="py-2 text-xs">{p.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td className="font-mono text-xs">{p.provider}</td>
              <td>{p.currency}</td>
              <td className="font-mono">{p.amount.toString()}</td>
              <td>{p.beneficiaryName}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
