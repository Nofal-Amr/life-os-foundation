import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinanceLayout,
});

const TABS = [
  { to: "/finance" as const, label: "Overview", exact: true },
  { to: "/finance/transactions" as const, label: "Transactions", exact: false },
  { to: "/finance/recurring" as const, label: "Recurring", exact: false },
  { to: "/finance/categories" as const, label: "Categories", exact: false },
];

function FinanceLayout() {
  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2" aria-label="Finance sections">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: tab.exact }}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
