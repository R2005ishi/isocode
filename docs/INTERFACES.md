# Cross-agent interfaces (orchestrator-owned)

Agents build in parallel in ONE working directory. Code against these exact names even if the
owning agent has not written them yet. If you need something not listed, write it in your own
folder or ask the orchestrator — do not edit another agent's files.

Shared, read-only: `prisma/schema.prisma`, `src/types/contracts.ts`, `src/lib/db.ts` (exports `db`),
`next.config.ts` (Agent B may add a `headers()` block only), `docs/ASSUMPTIONS.md` (anyone may APPEND
a line under the right heading), `docs/DECISIONS.md` (anyone may APPEND).

## Agent A — `src/server/services/` (pure; files marked [client-safe] must not import db/server-only)
- `emi.ts` [client-safe]: `computeEmi(input: EmiInput): EmiResult`; `EMI_DEFAULTS = { annualRatePct: 9.5, tenureMonths: 60, downPaymentPct: 10 }`; throws `RangeError` on invalid input.
- `sla.ts` [client-safe]: `SLA_MS = 5*60_000`, `SLA_AMBER_MS = 3*60_000`; `slaState(createdAt: Date|string, firstContactAt: Date|string|null, now?: Date): SlaState`; `slaRemainingMs(createdAt, now?): number` (negative when overdue).
- `mask.ts` [client-safe]: `maskRegistration(reg: string): string` (e.g. `UP32AB1282` → `UP32 •• ••82`); `maskPhone(phone: string): string` (`98XXX00001` → `98•••••001`).
- `pricing.ts` [client-safe]: `PriceComponentInput = { roadTaxPct: number; registrationFee: number; insurance: number; accessoriesPack: number; otherCharges: number; validUntil: Date }`; `computeOnRoad(exShowroom: number, c: PriceComponentInput, meta: { variantId: string; citySlug: string; cityName: string }, now?: Date): OnRoadBreakup`; `PRICE_DISCLAIMER` string; `class PriceNotPublishedError extends Error`.
- `pricing.repo.ts` (db): `getOnRoadPrice(variantId: string, citySlug: string): Promise<OnRoadBreakup>` — throws `PriceNotPublishedError`.
- `slots.ts` [client-safe]: `SLOT_MINUTES = 45`; `generateSlots(opts: { date: string /*YYYY-MM-DD IST*/; openHour: number; closeHour: number; slotMinutes?: number; booked: Date[]; now?: Date }): Slot[]`; `isValidSlotStart(opts: { slotStart: Date; openHour; closeHour; slotMinutes?; now? }): boolean`; `BOOKING_WINDOW_DAYS = 14`. All times IST (Asia/Kolkata) ↔ UTC.
- `slots.repo.ts` (db): `getSlots(showroomId: string, demoCarId: string, date: string): Promise<Slot[]>`.
- `assignment.ts`: pure `pickConsultant(candidates: { id: string; showroomId: string|null; openLeads: number; lastAssignedAt: Date|null; specialtyModelIds?: string[] }[], showroomId: string|null, modelId?: string|null): string|null`; db-backed `assignLead(tx: Prisma.TransactionClient, leadId: string, showroomId: string|null, modelId?: string|null): Promise<{ id: string; name: string } | null>` (updates lead.assignedToId, user.lastAssignedAt, writes LeadActivity ASSIGNED; falls back to an ADMIN).
- `ids.ts`: `makeReference(prefix: "TD"|"EN"): string` → e.g. `TD-7K2Q9`.

## Agent B — API, auth, security, seed
- `src/auth.ts`: `export const { handlers, auth, signIn, signOut } = NextAuth(...)`. Session: `session.user = { id, name, email, role: Role, showroomId: string|null }`. Credentials: email + password (bcryptjs). Sign-in page `/login`.
- `src/auth.config.ts` (edge-safe config used by `middleware.ts`).
- `src/app/api/auth/[...nextauth]/route.ts`.
- `middleware.ts`: `/inbox/**` → CONSULTANT|ADMIN; `/admin/**` → ADMIN (USED_CAR_MANAGER may access `/admin/used-cars` only). Unauthenticated → `/login?next=…`; wrong role → `/forbidden` (owned by Agent E).
- `src/lib/security/guard.ts`: `requireRole(...roles: Role[]): Promise<SessionUser>` (throws `ApiErr`); `class ApiErr { status; code; message; fields? }`; `withApi(handler)` wraps a route handler → maps `ApiErr`, `ZodError`, `PriceNotPublishedError` to the `{ error: {...} }` shape.
- `src/lib/security/rate-limit.ts`: `rateLimit(key: string, limit: number, windowMs: number): boolean`.
- `src/server/workflows/` (B owns): `bookTestDrive(input)`, `createEnquiry(input)`, `listLeads(user, query)`, `getLeadDetail(user, id)`, `updateLead(user, id, patch)`, `markContacted(user, id, note?)`, `sendMessage(user, id, input)`, `optOut(phone)`, `listConsultants()`, admin CRUD functions. Mock messaging helper `src/server/workflows/messaging.ts`: `sendMock({ leadId, channel, to, template, body })` — writes MessageLog + console, refuses if opted out.
- All API routes in the contract table (`src/types/contracts.ts`).
- `prisma/seed.ts` — idempotent. Demo logins (password for all: `Demo@1234`):
  `admin@brandx.test` (ADMIN), `ucm@brandx.test` (USED_CAR_MANAGER), `asha.consultant@brandx.test`,
  `ravi.consultant@brandx.test` (CONSULTANT, Gomti Nagar showroom), plus 4 more consultants,
  `buyer1@brandx.test`, `buyer2@brandx.test` (BUYER).
  Slugs: cities `lucknow|kanpur|varanasi`; showrooms `gomti-nagar|hazratganj|kanpur-mall-road`;
  models `model-h|model-c|model-s|model-t`; variant NEW-H-02 → `/cars/model-h/zx-automatic-petrol`;
  used cars `UC-1182` slug `uc-1182-model-c-vx-diesel-2022`, `UC-1190` slug `uc-1190-model-s-lx-petrol-2021`.
  Images: `/cars/model-h.svg` etc. (Agent D creates the SVGs in `public/cars/`).

## Agent C — `src/server/ai/`
- `index.ts`: `generateSummary(leadId: string, actorId: string): Promise<AiSummaryResult>`; `generateDraft(leadId: string, actorId: string, locale?: Locale): Promise<AiDraftResult>`; `priceBand(modelName: string, year: number, km: number): Promise<PriceBandResult>`.
- `provider.ts`: `interface AiProvider { name: string; complete(req: { system: string; prompt: string; maxTokens?: number; timeoutMs?: number }): Promise<string> }`; `getProvider(): AiProvider` (Anthropic when `ANTHROPIC_API_KEY` set, else Mock); `setProviderForTests(p)`.
- `guardrails.ts`: `findDiscountLanguage(text): string[]`; `findUnverifiedRupees(text, allowed: number[]): string[]`.

## Agent D — buyer frontend
- Root `src/app/layout.tsx`, `src/app/globals.css` (tokens), `src/i18n/request.ts`, `messages/en.json`, `messages/hi.json`, `src/lib/format.ts` (`formatINR(n)` Indian grouping `₹12,45,000`; `formatDateIST`), `src/components/ui/*`, `src/components/public/*`, `src/app/(public)/**`, `src/server/queries/public.ts` (catalogue reads; MUST select used-car fields explicitly and return `registrationMasked` via `maskRegistration`, never `registration`), `public/cars/*.svg`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/privacy/` + `src/app/opt-out/` (inside `(public)`).
- Language toggle sets cookie `NEXT_LOCALE` = `en|hi`.
- Exposes `src/components/ui/*` + tokens for Agent E.

## Agent E — staff & admin frontend
- `src/app/login/`, `src/app/forbidden/`, `src/app/(staff)/inbox/**`, `src/app/admin/**`, `src/components/staff/*`, `src/components/providers/query-provider.tsx`.
- Talks to the API via `fetch` (TanStack Query) using contract types; server components may call `auth()`.
