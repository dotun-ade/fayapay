import Link from 'next/link';

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/cardholders', label: 'Cardholders' },
  { href: '/cards', label: 'Cards' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/collections', label: 'Collections' },
  { href: '/kyc', label: 'KYC queue' },
  { href: '/providers', label: 'Provider health' },
  { href: '/webhooks', label: 'Webhook log' },
];

export function Sidebar() {
  return (
    <aside className="w-60 bg-fayapay-900 text-fayapay-50 p-6 flex flex-col gap-2">
      <div className="font-mono text-xl mb-6">fayapay</div>
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="hover:bg-fayapay-700 hover:text-fayapay-50 rounded px-3 py-2 text-sm"
        >
          {n.label}
        </Link>
      ))}
      <div className="mt-auto pt-4 border-t border-fayapay-700 text-xs text-fayapay-100 font-mono">
        env: {process.env.NODE_ENV}
      </div>
    </aside>
  );
}
