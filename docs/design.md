# Design system — "premium showroom"

The `frontend-design` skill was not available in this build environment, so the direction below
was set by hand using standard practice (type scale, 8-pt spacing, WCAG AA contrast, mobile-first).

## Direction
A quiet, well-lit showroom: large car imagery on warm off-white, generous white space, and one
confident accent used only for the action we want the buyer to take next (book / enquire).
Price and the next step are always visible above the fold on a phone.

## Colour (oklch tokens in `src/app/globals.css`)
- Warm neutrals (hue ≈ 75, very low chroma): `--background` paper, `--card` white, `--muted` stone,
  `--foreground` warm ink. Borders are warm, never cool grey.
- **One accent — "ember" copper** (`--primary`, `oklch(0.53 0.14 42)`): primary buttons, links,
  focus ring, selected chips. White text on it passes AA (≥ 4.5:1).
- Status colours are functional only and muted: `--success`, `--warning`, `--destructive`
  (used for SLA chips, price-expired warnings, form errors). They are not decorative accents.
- `--accent` (shadcn's hover surface) is deliberately a neutral stone, so it is not a second accent.

## Type (`next/font/google`, both cover Latin + Devanagari)
- Display: **Anek Devanagari** (variable width + weight grotesk) — `font-heading` / `--font-display`.
  Headings use a slightly expanded width (`.display` sets `font-stretch: 112%`) for a confident,
  automotive feel, and render Hindi headings in the same family.
- Text: **Mukta** (400/500/600/700) — `font-sans`. Excellent Hindi readability; matches Anek's proportions.
- Scale (rem): 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 / 3.5. Tabular numerals (`.tabular`) for prices.

## Space, radius, depth
- 8-pt spacing: use Tailwind steps 2, 4, 6, 8, 10, 12, 16, 20, 24 (= 8 … 96 px). 4 px (`1`) only for
  hairline gaps inside controls.
- Radius: `--radius` 0.75rem; `rounded-md` inputs, `rounded-xl` cards, `rounded-full` chips/pills.
- Shadows: `--shadow-soft` (cards at rest), `--shadow-lift` (hover / sticky bars), exposed as
  `shadow-soft` and `shadow-lift` utilities.
- Tap targets ≥ 40 px (buttons default `h-10`, `lg` = `h-12`); inputs `h-10`.

## Imagery
Illustrative, hand-written **SVG silhouettes** in `public/cars/` (`model-h|c|s|t` + `-side`, `-rear`).
Each body type has its own outline: Model H = full-size SUV, Model C = sedan,
Model S = hatchback, Model T = compact SUV (matching the seeded body types). No logos, number plates or people.
ASSUMPTION: no licensed photography is available, so illustrations stand in for product photos.

## Components
shadcn/ui (radix-nova) in `src/components/ui`, re-tokenised (not default-looking).
Buyer-only compositions live in `src/components/public`.

## Tokens other screens can use (Agent E)
`bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `bg-primary` (accent),
`text-success` / `bg-success-soft`, `text-warning` / `bg-warning-soft`, `text-destructive` /
`bg-destructive-soft`, `shadow-soft`, `shadow-lift`, `font-heading`, `.display`, `.tabular`, `.container-page`.
