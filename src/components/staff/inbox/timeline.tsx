import {
  ArrowRightLeftIcon,
  BellOffIcon,
  CalendarCheckIcon,
  CircleDotIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  PlusCircleIcon,
  SparklesIcon,
  StickyNoteIcon,
  UserCheckIcon,
  SirenIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LeadDetail } from "@/types/contracts";
import { formatStaffDateTime } from "../labels";

const ICON: Record<string, LucideIcon> = {
  CREATED: PlusCircleIcon,
  ASSIGNED: UserCheckIcon,
  REASSIGNED: ArrowRightLeftIcon,
  ESCALATED: SirenIcon,
  STATUS_CHANGED: CircleDotIcon,
  CONTACTED: PhoneCallIcon,
  NOTE: StickyNoteIcon,
  MESSAGE_SENT: MessageCircleIcon,
  TEST_DRIVE_BOOKED: CalendarCheckIcon,
  OPTED_OUT: BellOffIcon,
  AI_SUMMARY: SparklesIcon,
  AI_DRAFT: SparklesIcon,
};

type Entry =
  | { kind: "activity"; id: string; at: string; type: string; note: string; actor: string | null }
  | { kind: "message"; id: string; at: string; channel: string; body: string };

/** Activities and outbound messages merged into one newest-first feed. */
export function Timeline({ lead }: { lead: LeadDetail }) {
  const entries: Entry[] = [
    ...lead.activities.map(
      (a): Entry => ({ kind: "activity", id: a.id, at: a.createdAt, type: a.type, note: a.note, actor: a.actorName }),
    ),
    ...lead.messages.map(
      (m): Entry => ({ kind: "message", id: m.id, at: m.createdAt, channel: m.channel, body: m.body }),
    ),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
      {entries.map((e) => {
        const Icon = e.kind === "message" ? MessageCircleIcon : (ICON[e.type] ?? CircleDotIcon);
        return (
          <li key={`${e.kind}-${e.id}`} className="relative flex gap-3">
            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              {e.kind === "activity" ? (
                <>
                  <p className="text-sm">{e.note}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.actor ? `${e.actor} · ` : ""}
                    <time dateTime={e.at}>{formatStaffDateTime(e.at)}</time>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {e.channel === "WHATSAPP" ? "WhatsApp" : e.channel} (mock) sent ·{" "}
                    <time dateTime={e.at}>{formatStaffDateTime(e.at)}</time>
                  </p>
                  <p className="mt-1 rounded-lg rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                    {e.body}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
