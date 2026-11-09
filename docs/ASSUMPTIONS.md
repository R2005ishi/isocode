# Assumptions

Everything here is **not** in the client brief and was chosen by me. Each item is labelled
**ASSUMPTION** and is also marked in code next to where the value lives.

## Pricing (all figures editable by admin in the city price table)
- **ASSUMPTION** — Cities served: Lucknow, Kanpur, Varanasi.
- **ASSUMPTION** — UP road tax: 8 % of ex-showroom below ₹10,00,000; 10 % at or above ₹10,00,000.
- **ASSUMPTION** — Registration: ₹600 RTO fee + ₹1,500 handling = ₹2,100.
- **ASSUMPTION** — First-year insurance ≈ 3.2 % of ex-showroom (rounded to the rupee).
- **ASSUMPTION** — Accessories pack: ₹15,000 (shown as its own line; buyer can see it).
- **ASSUMPTION** — Price validity: 30 days from when the admin saves the row.
- If no price row exists for a variant + city, the site says "Price not yet published for this city"
  and never estimates.

## Showrooms & test drives
- **ASSUMPTION** — Showroom hours 10:00–19:00 IST, every day.
- **ASSUMPTION** — Test-drive slot length 45 minutes; last slot must end by closing time.
- **ASSUMPTION** — One demo car per variant per showroom (seeded); buyers pick a demo car.
- **ASSUMPTION** — Bookings open for today (future slots only) and the next 14 days.

## EMI calculator (all user-editable)
- **ASSUMPTION** — 9.5 % p.a., 60 months, 10 % down payment of the on-road total.

## Leads
- 5-minute first-response SLA comes from the brief's success metric (90 % of leads called within 5 min).
- **ASSUMPTION** — SLA chip turns amber at 3 minutes, red at 5 minutes.
- **ASSUMPTION** — Auto-assignment by showroom AND model: pools in order (1) same showroom + specialises in the
  lead's model, (2) same showroom, (3) any consultant specialising in the model, (4) any active consultant; within a
  pool fewest open leads, tie → longest since last assignment; if none → admin (lead desk). A consultant with no
  specialty models is a generalist (eligible in showroom pools, never a model match). Model = interest model
  (test drive: demo car's model; enquiry: interest model/variant's model, or a used car's model matched by name).
- **ASSUMPTION** — "Open" lead = status NEW, CONTACTED, TEST_DRIVE_BOOKED or NEGOTIATION.
- **ASSUMPTION** — Booking/enquiry references are `TD-`/`EN-` + 5 characters from an alphabet without 0/O/1/I (≈33.5 M combinations; uniqueness enforced by the DB).
- **ASSUMPTION** — Auto-assignment final tie-break is consultant id (ascending) so results are deterministic; the admin fallback is the earliest-created active admin.

## Catalogue
- The three sample rows from the brief are seeded exactly (NEW-H-02, UC-1182, UC-1190).
- **ASSUMPTION** — All other models, variants, specs, colours, showrooms, consultants and used cars
  are invented sample data, named generically (Model H / C / S / T) with obviously fake contacts.
- **ASSUMPTION** — Car imagery is illustrative SVG silhouettes, not real photos or brand marks.

## Messaging
- WhatsApp, SMS, payments and DMS are mocked: messages are written to the `MessageLog` table and the console.

## Brief
- The full client brief text was not available in this build session; the build follows the
  requirements captured in the master prompt. Anything not stated there is listed above.

## Seed data (prisma/seed.ts)
- **ASSUMPTION** — Variants other than NEW-H-02, their specs, colours and ex-showroom prices are invented.
- **ASSUMPTION** — Model T SX Turbo Automatic Petrol has no Varanasi price row (demonstrates "Price not yet published").
- **ASSUMPTION** — Used cars other than UC-1182 / UC-1190, plus owners/registration/inspection for those two, are invented.
- **ASSUMPTION** — Past sales (12 rows, Model C / Model S) used by the manager-only price band are invented.
- **ASSUMPTION** — Staff, buyers and leads are fictional; phones are fake `98000000xx`, emails use `.test` domains.

## AI drafts & price band (src/server/ai)
- **ASSUMPTION** — Draft quotes the on-road price for the lead's city, or Lucknow when the lead has no city.
- **ASSUMPTION** — Drafts propose up to 3 free slots from today + next 3 days (spread across days), never a slot starting within 2 hours.
- **ASSUMPTION** — Draft hard cap 140 words (prompt asks ≤ 90); longer output is treated as invalid.
- **ASSUMPTION** — AI call timeout 8 s.
- **ASSUMPTION** — Used-car comparables: same model name, model year ±1, odometer ±25,000 km; at least 3 needed; band = Q1–Q3 rounded to ₹1,000.

## Security & sessions
- **ASSUMPTION** — Staff sessions last 8 hours (one shift).
- **ASSUMPTION** — Public forms are limited to 10 submissions per minute per IP per route.

## Buyer site (src/app/(public))
- **ASSUMPTION** — Personal data from enquiries and bookings is kept for 12 months after the last contact (stated on /privacy).
- **ASSUMPTION** — Default city for on-road prices is Lucknow (cookie `city`); buyers can switch to Kanpur or Varanasi.
- **ASSUMPTION** — Used-car filter presets: max km 20k–1 lakh, max price ₹4–15 lakh, year from the last 8 years (any value works via the URL).
- **ASSUMPTION** — Car images are illustrative SVG silhouettes (no licensed photography available).

## Staff & admin UI (src/app/admin, src/components/staff)
- **ASSUMPTION** — A missing city price row is pre-filled with the pricing assumptions above (8 %/10 % road tax, ₹2,100 registration, 3.2 % insurance, ₹15,000 accessories, 30 days) so the admin only reviews and publishes; nothing is shown to buyers until saved.
- **ASSUMPTION** — "Contacted within 5 min" metric: leads still inside their 5-minute window are excluded; uncontacted leads past 5 minutes count as misses; days are IST calendar days.
- **ASSUMPTION** — Inbox "most urgent first": uncontacted open leads oldest-first, then everything else newest-first.

## Trade-in requests (src/server/workflows/trade-in*.ts, /trade-in)
- **ASSUMPTION** — Trade-in year must be 1990 or later and not after the current IST year.
- **ASSUMPTION** — Odometer 0–10,00,000 km, and at most 1 lakh km per year of age (catches typos like an extra zero).
- **ASSUMPTION** — Owners 1–9 (form offers 1st–4th and "5 or more"); expected price optional, ₹10,000–₹1 crore.
- **ASSUMPTION** — Condition is one of Excellent / Good / Fair / Needs work; fuel uses the catalogue Fuel enum (optional).
- **ASSUMPTION** — Registration accepts standard state plates (e.g. UP32AB1234) and Bharat series (22BH1234AB); stored normalised (upper-case, no spaces) and shown only to staff.
- **ASSUMPTION** — Trade-in references are `TI-` + 5 characters (same alphabet as `EN-`/`TD-`); like enquiry references they are recorded in the lead's CREATED activity note.
- **ASSUMPTION** — When a showroom is chosen the lead's city is the showroom's city; otherwise the buyer's `city` cookie is used.

## Service booking (src/server/services/service-slots.ts, src/server/workflows/service.ts)
- **ASSUMPTION** — Service slots are 60 minutes (a drop-off window); the last slot must end by workshop closing (seeded 09:00–18:00 IST → 9 slots/day).
- **ASSUMPTION** — Each slot holds as many cars as the workshop has bays (`Workshop.bays`); only CONFIRMED bookings use a bay, so cancelling or completing frees it.
- **ASSUMPTION** — Service bookings use the test-drive window: today (slots not yet started) + the next 14 days.
- **ASSUMPTION** — Service references are `SV-` + 5 characters from the same no-0/O/1/I alphabet.
- **ASSUMPTION** — Service types: Periodic maintenance, Repair, Accident/body work, Other. Odometer and notes are optional; registration is 6–11 letters/digits after removing spaces/hyphens.
- **ASSUMPTION** — A service booking is not a sales lead: no lead, consultant assignment or WhatsApp mock is created.

## Offers & banners CMS (src/server/workflows/cms*.ts, /admin/offers, /admin/banners)
- **ASSUMPTION** — Offer/banner dates entered as calendar days are IST: a start date begins at 00:00 IST, an end date runs through 23:59:59 IST of that day.
- **ASSUMPTION** — Banner images must be paths under /public (e.g. `/cars/model-h.svg`); external https images are rejected because the site CSP is `img-src 'self'` and next/image has no remote hosts configured.
- **ASSUMPTION** — Only the `HOME` placement exists; at most 5 live banners and 6 live offers are shown per page (sortOrder, then soonest-ending).
- **ASSUMPTION** — Model and variant pages show offers for that model plus "all models" offers; offers are model-level (no per-variant offers).
- **ASSUMPTION** — When a Hindi field is blank, the English text is shown to Hindi visitors.

## Portal CSV lead import
- **ASSUMPTION** — Portal leads are recorded with `consent: true, consentAt = import time`: the buyer consented on the portal, whose terms let it share the enquiry with the dealer. Imported leads get no automatic WhatsApp acknowledgement (the portal already acknowledged them).
- **ASSUMPTION** — The lead's `createdAt` (and so the 5-minute SLA) starts at import, not at the portal's enquiry date; the portal date is kept in the CREATED activity note.
- **ASSUMPTION** — Skipped (reported per row, never fatal): invalid/missing name or phone, duplicate lead id or phone within the file, a (portal, lead id) already imported, a phone on the opt-out register, a phone that already has an open lead. Unknown model/variant/city/showroom or a bad email are warnings only: the row is imported and the raw value is kept in the lead's message.
- **ASSUMPTION** — Showroom for an imported row: CSV showroom (slug/name) → the admin's default showroom → first showroom in the row's city → none. Limits: 2,000 rows and 1 MB per file. Row numbers are spreadsheet-style (header = row 1).
- **ASSUMPTION** — Well-known portal names are canonicalised (`cardekho` → `CarDekho`) so re-imports dedupe on the same (portalName, externalRef).

## Missed-SLA escalation
- **ASSUMPTION** — A NEW lead with no first contact 5 minutes after creation is reassigned once to the next-best consultant (never the same person; falls back to the lead desk admin) and the lead desk gets an SMS alert (mock).
- **ASSUMPTION** — At 10 minutes, if still not contacted, the lead desk is alerted a second time; there is no further reassignment.
- **ASSUMPTION** — The sweep runs on staff inbox polls (at most every 20 s per server process) and on `GET /api/cron/escalate` with `Authorization: Bearer $CRON_SECRET` for an external scheduler.
