import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function KycQueue() {
  const rows = await prisma.kycRecord.findMany({
    where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { cardholder: true },
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">KYC queue</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Cardholder</th>
            <th>Provider</th>
            <th>Type</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-fayapay-100">
              <td className="py-2">
                {r.cardholder.firstName} {r.cardholder.lastName}
              </td>
              <td className="font-mono text-xs">{r.provider}</td>
              <td className="font-mono text-xs">{r.type}</td>
              <td>{r.status}</td>
              <td>{r.attempts}</td>
              <td className="text-xs">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
