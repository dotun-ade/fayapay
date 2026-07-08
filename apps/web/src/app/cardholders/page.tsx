import { prisma } from '@fayapay/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Cardholders() {
  const rows = await prisma.cardholder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { _count: { select: { cards: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Cardholders</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Name</th>
            <th>Country</th>
            <th>KYC</th>
            <th>Cards</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-fayapay-100">
              <td className="py-2">
                <Link href={`/cardholders/${r.id}`} className="hover:underline">
                  {r.firstName} {r.lastName}
                </Link>
                <div className="text-xs text-fayapay-500">{r.email}</div>
              </td>
              <td>{r.country}</td>
              <td>
                <Pill status={r.kycStatus} />
              </td>
              <td>{r._count.cards}</td>
              <td className="text-xs text-fayapay-500">{r.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ status }: { status: string }) {
  const color =
    status === 'APPROVED'
      ? 'bg-green-100 text-green-800'
      : status === 'REJECTED'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800';
  return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{status}</span>;
}
