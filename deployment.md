# Deployment — Brand X Dealer Platform (Company A, Lucknow)

- **Repository:** https://github.com/R2005ishi/isocode
- **Live app:** https://isocode-pi.vercel.app

## 1. Run it locally

**You need:** Node.js 20 or 22 (built and tested on 22.13), npm 10+, and PostgreSQL 14+ (local install, Docker, or a free Neon database).

1. Clone and install:

   ```bash
   git clone https://github.com/R2005ishi/isocode.git
   cd isocode
   npm ci
   ```

   `npm ci` also runs `prisma generate` (postinstall).

2. Create a database, e.g. `brandx`, and make sure it is **UTF-8** (the seed contains Hindi text):

   ```bash
   createdb -E UTF8 brandx
   ```

3. Copy the environment file and fill it in (see section 3):

   ```bash
   cp .env.example .env
   ```

   Minimum for local use: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Generate a secret with:

   ```bash
   openssl rand -base64 32
   ```

4. Create the tables and load the sample data:

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

   The seed is safe to re-run. Leads, bookings and AI history are recreated with timestamps relative to "now", so the response timers and escalation demo correctly.

5. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 (buyer site) and http://localhost:3000/login (staff).

### Tests

```bash
npm test                      # unit tests (pricing, EMI, slots, assignment, SLA, escalation, AI guardrails, CSV, …)
npm run typecheck
npm run lint
```

API route tests need a separate database whose name ends in `_test`; they migrate and seed it themselves:

```bash
TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/brandx_test" npx vitest run tests/unit/api
```

End-to-end (Playwright, desktop and phone viewports): `npm run e2e`. It builds and starts the app itself, or reuses one already running on port 3000.

## 2. How it is deployed

| Part | Service | Why |
|---|---|---|
| Web app + API | **Vercel** (Next.js 15, Node 22, region `sin1` Singapore) | Server rendering for SEO and fast 4G loads; one deploy for site, staff app and API |
| Database | **Neon** Postgres (serverless, `ap-southeast-1` Singapore) | Managed Postgres; Prisma migrations apply on every deploy |
| AI | Anthropic API (optional) | Without a key the app uses safe templates and says so |
| Messages, payments, DMS | Mocked | Out of scope per the brief; WhatsApp/SMS are written to the `MessageLog` table |

Steps:

1. Create a Neon project and copy its **pooled** connection string.
2. Import the GitHub repo in Vercel and add the environment variables from section 3. `vercel.json` pins the functions to Singapore (`sin1`), next to the database; keeping app and database in the same region matters more for page speed than anything else here.
3. Deploy. Vercel runs `npm run vercel-build`, i.e. `prisma migrate deploy && next build`, so the schema is always current.
4. Seed once from your machine against the Neon database:

   ```bash
   DATABASE_URL="<neon-url>" npm run db:seed
   ```

5. **Missed-call escalation schedule (optional):** escalation already runs whenever staff have the inbox open. To make it run on a fixed schedule too, point any scheduler at `GET /api/cron/escalate` every 1–5 minutes, with the header `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby cron runs only once a day, so use something like cron-job.org.

## 3. Environment variables (names only)

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Signs staff sign-in sessions (Auth.js) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public base URL for canonical links, sitemap and robots. On Vercel it falls back to the project's production domain |
| `ANTHROPIC_API_KEY` | No | Enables AI buyer summaries and first-reply drafts; empty → template fallback |
| `AI_MODEL` | No | Model id; defaults to `claude-sonnet-5-5` |
| `CRON_SECRET` | No | Enables the scheduled escalation endpoint; unset → endpoint returns 503 |
| `TEST_DATABASE_URL` | Tests only | `*_test` database for the API tests |

No secrets are committed. `.env` is git-ignored; `.env.example` lists names only.

## 4. Demo logins for the reviewer

Every demo account uses the password **`Demo@1234`**. All people, phone numbers and emails in the sample data are fictional.

| Role | Email | What to try |
|---|---|---|
| Admin / lead desk | `admin@brandx.test` | `/admin`: prices, models, used stock, users, offers, banners, CSV import, service bookings, AI quality |
| Sales consultant | `asha.consultant@brandx.test` | `/inbox`: own leads, 5-min timer, AI summary and draft, send, reassign |
| Sales consultant | `ravi.consultant@brandx.test` | A second consultant, to see that each one only sees their own leads |
| Used-car manager | `ucm@brandx.test` | `/admin/used-cars`: the only role that sees the AI used-car price band |

Buyers need no login. To try it: browse `/cars` and `/used`, book a test drive at `/test-drive`, book a service at `/service`, or request a trade-in at `/trade-in`. Each new enquiry is auto-assigned and shows up in the consultant's inbox.

A sample CSV for the portal import can be downloaded from `/admin/lead-import`.

## 5. Known limits

- Rate limiting is in-memory per server instance, so on serverless it is per instance, not global.
- The sweep that runs on inbox polls is throttled per server instance; for guaranteed timing use the cron endpoint.
- WhatsApp/SMS, payments and the DMS are mocked, as the brief allows.
