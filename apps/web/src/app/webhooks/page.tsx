import { prisma } from '@fayapay/db';

export const dynamic = 'force-dynamic';

export default async function Webhooks() {
  const rows = await prisma.webhookEvent.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 200,
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Webhook log</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-fayapay-500 uppercase text-xs">
          <tr>
            <th className="py-2">Received</th>
            <th>Provider</th>
            <th>Event type</th>
            <th>Signature</th>
            <th>Processed</th>
            <th>Attempts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className="border-t border-fayapay-100">
              <td className="py-2 text-xs">{w.receivedAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td className="font-mono text-xs">{w.provider}</td>
              <td className="font-mono text-xs">{w.eventType}</td>
              <td>
                <span className={w.signatureValid ? 'text-green-700' : 'text-red-700'}>
                  {w.signatureValid ? 'ok' : 'invalid'}
                </span>
              </td>
              <td>{w.processedAt ? '✓' : '⋯'}</td>
              <td>{w.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
