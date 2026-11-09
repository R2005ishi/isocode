import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CarFrontIcon,
  CarIcon,
  FileUpIcon,
  ImageIcon,
  InboxIcon,
  TableIcon,
  TagIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { requireStaff } from "@/components/staff/require-staff";
import { SlaChart } from "@/components/staff/admin/sla-chart";
import { formatDuration } from "@/components/staff/labels";
import { cn } from "@/lib/utils";
import { getSlaOverview } from "./overview-data";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/** From the brief's success metric: 90 % of leads called within 5 minutes. */
const TARGET_PCT = 90;

const LINKS = [
  { href: "/inbox?scope=all", label: "All leads", desc: "Live inbox across consultants", Icon: InboxIcon },
  { href: "/admin/models", label: "Models & variants", desc: "Catalogue and ex-showroom prices", Icon: CarFrontIcon },
  { href: "/admin/prices", label: "City prices", desc: "Road tax, registration, insurance", Icon: TableIcon },
  { href: "/admin/used-cars", label: "Used stock", desc: "Certified pre-owned listings", Icon: CarIcon },
  { href: "/admin/users", label: "Users & roles", desc: "Staff accounts and showrooms", Icon: UsersIcon },
  { href: "/admin/lead-import", label: "Import portal leads", desc: "Upload a CSV from a lead portal", Icon: FileUpIcon },
  { href: "/admin/service", label: "Service bookings", desc: "Workshop bays and bookings", Icon: WrenchIcon },
  { href: "/admin/offers", label: "Offers", desc: "Model and dealership offers", Icon: TagIcon },
  { href: "/admin/banners", label: "Banners", desc: "Home page promotions", Icon: ImageIcon },
];

export default async function AdminOverviewPage() {
  // Defence in depth: this page reads the database directly.
  await requireStaff(["ADMIN"], "/admin");
  const o = await getSlaOverview();
  const onTarget = o.pct !== null && o.pct >= TARGET_PCT;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lead response over the last 30 days (IST).</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col justify-between gap-6 rounded-xl border bg-background p-5">
          <div>
            <p className="text-sm text-muted-foreground">Leads contacted within 5 min</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight">{o.pct === null ? "—" : `${o.pct}%`}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {o.decided ? `${o.met} of ${o.decided} leads · last 30 days` : "No leads with a known outcome yet"}
            </p>
            {o.pct !== null && (
              <p
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  onTarget
                    ? "border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
                )}
              >
                {onTarget ? "✓ On target" : "▲ Below target"} ({TARGET_PCT}%)
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Waiting now</dt>
              <dd className="text-lg font-semibold">{o.waitingNow}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Overdue now</dt>
              <dd className={cn("text-lg font-semibold", o.overdueNow > 0 && "text-red-700 dark:text-red-400")}>
                {o.overdueNow}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Auto-escalated</dt>
              <dd className="text-lg font-semibold">{o.escalated}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Median first reply</dt>
              <dd className="text-lg font-semibold">
                {o.medianResponseMs === null ? "—" : formatDuration(o.medianResponseMs)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-background p-5">
          <h2 className="text-sm font-semibold">Contacted within 5 min, by day</h2>
          <p className="mb-6 text-xs text-muted-foreground">
            % of each day’s leads with a first contact inside 5 minutes. Leads still inside their window aren’t counted yet.
          </p>
          <SlaChart days={o.days} target={TARGET_PCT} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Manage</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LINKS.map(({ href, label, desc, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-xl border bg-background p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="mt-3 flex items-center gap-1 text-sm font-medium">
                  {label}
                  <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
