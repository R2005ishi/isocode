"use client";

import { useState } from "react";
import type { SlaDay } from "@/app/admin/overview-data";

/**
 * Daily "% contacted within 5 minutes" columns. Single series → no legend (the title names it).
 * Plain HTML/CSS bars (no chart library) with a per-column hover/focus tooltip and a table view.
 * Colours follow the dataviz reference palette (sequential blue), redefined for dark mode.
 */
export function SlaChart({ days, target }: { days: SlaDay[]; target: number }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = [0, 50, 100];

  return (
    <div className="sla-viz">
      <style>{`
        .sla-viz { --bar: #2a78d6; --bar-hover: #1c5cab; --grid: #e7e6e2; --target: #52514e; }
        .dark .sla-viz { --bar: #3987e5; --bar-hover: #86b6ef; --grid: #383835; --target: #c3c2b7; }
        @media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"])) .sla-viz { --bar: #3987e5; --bar-hover: #86b6ef; --grid: #383835; --target: #c3c2b7; } }
      `}</style>
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="relative h-44 w-8 shrink-0 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - t}%` }}>
              {t}%
            </span>
          ))}
        </div>
        <div className="relative h-44 flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ top: `${100 - t}%`, background: "var(--grid)" }} aria-hidden />
          ))}
          {/* Target reference line — drawn above the bars so it stays readable */}
          <div
            className="pointer-events-none absolute inset-x-0 z-[1] border-t"
            style={{ top: `${100 - target}%`, borderColor: "var(--target)" }}
            aria-hidden
          >
            <span className="absolute top-0.5 left-1 rounded bg-background/90 px-1 text-[11px] text-muted-foreground">
              Target {target}%
            </span>
          </div>
          <ol
            className="absolute inset-0 flex items-end gap-[2px]"
            aria-label="Share of leads contacted within 5 minutes, by day"
            onMouseLeave={() => setActive(null)}
          >
            {days.map((d, i) => (
              <li key={d.date} className="relative flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  className="flex h-full w-full items-end justify-center outline-none focus-visible:bg-muted/60"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={
                    d.pct === null
                      ? `${d.label}: no leads with a known outcome`
                      : `${d.label}: ${d.pct}% — ${d.met} of ${d.decided} leads contacted within 5 minutes`
                  }
                >
                  {d.pct !== null && (
                    <span
                      className="block w-full max-w-6 rounded-t-[4px] transition-colors"
                      style={{
                        height: `${Math.max(d.pct, 1)}%`,
                        background: active === i ? "var(--bar-hover)" : "var(--bar)",
                      }}
                    />
                  )}
                </button>
                {active === i && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
                    style={{
                      left: i < 4 ? 0 : i > days.length - 5 ? undefined : "50%",
                      right: i > days.length - 5 ? 0 : undefined,
                      transform: i >= 4 && i <= days.length - 5 ? "translateX(-50%)" : undefined,
                    }}
                  >
                    <p className="font-medium">{d.label}</p>
                    {d.pct === null ? (
                      <p className="text-muted-foreground">No leads with a known outcome</p>
                    ) : (
                      <p>
                        <span className="font-semibold">{d.pct}%</span>{" "}
                        <span className="text-muted-foreground">
                          ({d.met} of {d.decided})
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-1.5 ml-10 flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Day</th>
                <th className="px-3 py-1.5 text-right font-medium">Within 5 min</th>
                <th className="px-3 py-1.5 text-right font-medium">Leads</th>
                <th className="px-3 py-1.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-t">
                  <td className="px-3 py-1.5">{d.label}</td>
                  <td className="px-3 py-1.5 text-right">{d.met}</td>
                  <td className="px-3 py-1.5 text-right">{d.decided}</td>
                  <td className="px-3 py-1.5 text-right">{d.pct === null ? "—" : `${d.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
