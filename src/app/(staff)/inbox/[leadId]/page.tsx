import { requireStaff } from "@/components/staff/require-staff";
import { LeadDetailView } from "@/components/staff/inbox/lead-detail";
import { TradeInCard } from "@/components/staff/inbox/trade-in-card";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const user = await requireStaff(["CONSULTANT", "ADMIN"], `/inbox/${leadId}`);
  return (
    <div className="space-y-4">
      <LeadDetailView
        leadId={leadId}
        me={{ id: user.id, role: user.role === "ADMIN" ? "ADMIN" : "CONSULTANT" }}
      />
      {/* Renders only for TRADE_IN leads the viewer may open. */}
      <TradeInCard leadId={leadId} />
    </div>
  );
}
