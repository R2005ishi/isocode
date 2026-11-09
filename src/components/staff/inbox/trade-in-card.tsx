import { RepeatIcon } from "lucide-react";
import { formatINR, formatNumberIN } from "@/lib/format";
import { requireRole } from "@/lib/security/guard";
import { getTradeInForLead } from "@/server/workflows/trade-in";
import type { TradeInDetail } from "@/server/workflows/trade-in.schema";
import { formatStaffDateTime } from "../labels";
import { Panel } from "./panel";

const FUEL_LABEL: Record<NonNullable<TradeInDetail["fuel"]>, string> = {
  PETROL: "Petrol",
  DIESEL: "Diesel",
  CNG: "CNG",
  ELECTRIC: "Electric",
  HYBRID: "Hybrid",
};

const CONDITION_LABEL: Record<string, string> = {
  EXCELLENT: "Excellent — like new",
  GOOD: "Good — minor wear",
  FAIR: "Fair — visible wear / small dents",
  NEEDS_WORK: "Needs work — repairs required",
};

function ordinalOwner(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return n >= 5 ? "5 or more owners" : `${n}${suffix} owner`;
}

/**
 * Server component: the buyer's trade-in car for a lead (staff only — full registration shown).
 * Renders nothing when the lead has no trade-in or the viewer may not open this lead
 * (the lead view itself shows the not-found / forbidden state).
 */
export async function TradeInCard({ leadId }: { leadId: string }) {
  const trade = await requireRole("CONSULTANT", "ADMIN")
    .then((user) => getTradeInForLead(user, leadId))
    .catch(() => null);
  if (!trade) return null;
  return <TradeInPanel trade={trade} />;
}

export function TradeInPanel({ trade }: { trade: TradeInDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["Car", [trade.make, trade.modelName, trade.variantName].filter(Boolean).join(" ")],
    ["Year", trade.year],
    ["Odometer", `${formatNumberIN(trade.km)} km`],
    ["Owners", ordinalOwner(trade.owners)],
    ["Fuel", trade.fuel ? FUEL_LABEL[trade.fuel] : "—"],
    ["Condition", trade.condition ? (CONDITION_LABEL[trade.condition] ?? trade.condition) : "—"],
    [
      "Registration",
      trade.registration ? <span className="font-mono tracking-wide">{trade.registration}</span> : "—",
    ],
    [
      "Buyer expects",
      trade.expectedPrice !== null ? (
        <span className="font-semibold tabular-nums">{formatINR(trade.expectedPrice)}</span>
      ) : (
        "Not given"
      ),
    ],
  ];
  return (
    <Panel
      icon={RepeatIcon}
      title="Trade-in car"
      description={`Submitted ${formatStaffDateTime(trade.createdAt)} · valuation only after physical inspection`}
    >
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
