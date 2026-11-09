# Decisions log

One line per decision, with the reason.

- Next.js 15 App Router monolith — SSR for SEO and 4G speed, single deploy for a 7-day solo build.
- PostgreSQL + Prisma — unique `(demoCarId, slotStart)` makes double-booking impossible at the DB level.
- Prices live only in the admin `PriceComponent` table — the brief forbids AI-generated prices.
- Money stored as whole-rupee integers — no floating-point drift in price breakups.
- Auth.js v5 credentials + JWT carrying `role` — no external IdP needed; roles checked again in every handler.
- AI behind an `AiProvider` interface — tests run on a mock; the app falls back to templates when no key or on errors.
- Registration numbers masked on the server — full number never serialised to non-admin clients.
- Local dev DB is Homebrew Postgres 14 (Docker not installed on the build machine); prod is Neon.
- Seed: catalogue/users upserted on unique keys; leads, bookings, activities, AI outputs, message logs, opt-outs and past sales are wiped and recreated each run — their timestamps are relative to "now" so the SLA chips demo correctly. Dev/demo DB only.

### AI (src/server/ai)
- Data minimisation: the LLM never receives phone or email (not even selected from the DB); buyer is named by first name only, and phone/email-looking strings in free text are redacted before sending.
- Buyer text goes inside `<buyer_message>` tags, closing tags are stripped from it, and the system prompt says to treat it as data — prompt-injection defence in depth; guardrails catch what slips through.
- Guardrails run in code on every draft (discount words in English + Hindi; every rupee figure must match an admin breakup line or total, lakh/crore figures allowed only as a correct rounding) — prompts are requests, code is the guarantee.
- One retry with a stricter instruction, then a deterministic en/hi template built from verified data (names, real free slots, admin price). Status `BLOCKED` when the model kept breaking a rule, `FALLBACK` for timeout / invalid output / provider error / no key — the UI can say *why*.
- No API key → `FALLBACK` / `no_api_key` with the template, never canned text dressed up as AI, so the app is fully usable without a key and honest about it.
- Summary output is validated against `AiSummarySchema` (Zod); leads with no buyer or consultant text are forced to `confidence: "low"` with only known facts as needs — the model can't infer what isn't there.
- 8 s AbortController timeout per call (SDK retries capped at 1) — a consultant waiting on the 5-minute SLA must not wait on the AI.
- Model from `AI_MODEL` (default `claude-sonnet-5-5`) at effort `low`: short, well-specified tasks where latency matters more than deep reasoning.
- Expired admin prices are treated as "no price" for drafts — we don't quote a figure the admin table says is no longer valid.
- Every summary/draft (including fallbacks and blocked attempts) is stored in `AiOutput` with the input facts, allowed numbers, slots and each attempt — auditable; drafts are never sent from the AI module.
- Used-car price band is plain statistics (median, Q1–Q3 of comparable past sales), not an LLM — a pricing suggestion must be explainable and reproducible.
- API roles are re-read from the DB on every request (`requireRole`) — a demoted or deactivated user loses access immediately, not when the 8 h JWT expires.
- Middleware gates only pages (`/inbox`, `/admin`); API routes enforce auth themselves and return JSON 401/403 rather than redirects.
- A new consented form submission (test drive / enquiry) lifts an earlier opt-out for that phone — the buyer is explicitly asking to be contacted; noted on the lead timeline. Older leads stay flagged.
- Consultants always get only their own leads from `GET /api/leads` (scope=all is honoured for ADMIN only); after a consultant re-assigns a lead they lose access to it.
- Models/variants/used cars with leads or bookings cannot be hard-deleted (409 CONFLICT) — deactivate or mark SOLD instead; users are only ever deactivated (DELETE = soft).
- When an AI draft is sent (`aiOutputId` given), the edited text is re-checked for discount language and refused if any is found.
- Rate limit is in-memory per server instance (10 public POSTs/min per IP per route) — enough for a demo; a shared store would be needed for a hard global limit.
- CSP allows 'unsafe-inline' scripts/styles (Next bootstrap without nonces); 'unsafe-eval' and ws: only in dev.
- Buyer site: no locale-prefixed URLs; language is a cookie toggled by a no-JS server-action form — one indexable URL per car page.
- Buyer site: test-drive confirmation shows the WhatsApp text only from the booking response kept in sessionStorage — looking up a reference never exposes the buyer's name.
- Staff & admin UI is English-only (buyer UI is bilingual) — staff are a small internal team; AI drafts can still be generated in Hindi or English per lead.
- Sign-in routes through `/login/continue`, which reads the fresh session and redirects by role (a `?next=` is honoured only if it is a same-site path the role may open).
- Inbox SLA chips tick every second on the client using the same `slaState` as the server; the SLA filter is applied client-side against the live clock so a lead turns red exactly at 5:00, not at the next 15 s poll.
- Admin price grid previews the on-road total with the same `computeOnRoad` the buyer page uses, so the admin sees exactly what buyers will see before saving.
- Admin overview computes the 5-minute response rate in a server component with a read-only `db` aggregate (ADMIN-checked at the top) — no extra API needed for one internal chart.

### Trade-in requests
- A trade-in is a normal lead (source TRADE_IN) plus a 1:1 TradeInRequest row, created in one transaction and auto-assigned with the same rules as an enquiry (passing the car of interest to `assignLead` for specialist matching) — consultants work it from the same inbox and SLA.
- Same public contract as enquiries: rate-limited, consent must be literally `true`, fresh consent lifts an opt-out, response is only `{ leadId, reference }` — nothing about the car or the registration is echoed back.
- No buyer-facing price estimate: the form says valuation happens only after a physical inspection (no AI or formula prices for buyers).
- The staff trade-in card is a server component next to the lead view; it re-checks the role in the DB and the lead access rule, and renders nothing when access is denied.

### Service booking by bay capacity
- Capacity is enforced in a SERIALIZABLE transaction (count CONFIRMED bookings for workshop+slot, insert only if count < bays), retried once on serialization failure (P2034) — a slot holds N cars, so there is no unique index to lean on as with test drives; a second failure returns 409 instead of 500.
- The public confirmation page shows only non-personal details (no name/phone; registration masked), looked up by `SV-` reference.
- Admins can only move a CONFIRMED booking to CANCELLED or COMPLETED (conditional update, 409 otherwise) — re-confirming would need a fresh capacity check, so the buyer books again instead.

### Offers & banners CMS
- Offers are text-only cards rendered beside (never inside) the price, with a "subject to dealer terms" note — the admin price table stays the only price source and no offer changes an on-road figure.
- "Live" is decided in one place (`liveOfferWhere` / `liveBannerWhere` + `offerStatus` / `bannerStatus` in `cms.schema.ts`, unit-tested) so admin status chips and the public query agree; expired/inactive/scheduled items never reach buyers.
- Banner CTA links are same-site paths only (must start with a single `/`; `//`, `/\`, backslashes, whitespace and `javascript:` are rejected) — validated in the API schema and re-checked at render time.
- Home banners are a CSS scroll-snap row (no JS carousel) — no layout shift, no autoplay, works without JavaScript.

## Portal CSV import & model-aware assignment
- CSV is parsed with a small in-house RFC 4180 parser (`src/server/services/csv.ts`) rather than a dependency; the file is read client-side and posted as JSON text to `POST /api/leads/import` (ADMIN), with `dryRun: true` for the preview. Each row is created in its own transaction so one bad row never aborts the batch; the `LeadImport` row records counts and per-row skip reasons.
- `assignLead(tx, leadId, showroomId, modelId?)` gained an optional model id; consultants' `specialtyModelIds` are edited on the Users admin page.
