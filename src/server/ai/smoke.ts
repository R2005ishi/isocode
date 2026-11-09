/**
 * Manual live check of the AI module against a real lead in the dev database.
 *
 *   npx tsx --env-file=.env src/server/ai/smoke.ts <leadId> [en|hi]
 *
 * Prints the summary and draft results (status/reason/model + content). Without ANTHROPIC_API_KEY
 * both come back FALLBACK/no_api_key, which is the expected no-key behaviour.
 * Writes AiOutput rows like the real API would; never sends a message.
 */
import { db } from "@/lib/db";
import { generateDraft, generateSummary } from "./index";

async function main() {
  const [leadId, locale] = process.argv.slice(2);
  if (!leadId) {
    const sample = await db.lead.findFirst({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });
    console.error("Usage: npx tsx --env-file=.env src/server/ai/smoke.ts <leadId> [en|hi]");
    if (sample) console.error(`e.g. latest lead: ${sample.id} (${sample.name})`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn("ANTHROPIC_API_KEY is empty — expect FALLBACK / no_api_key (template output).");
  }
  console.log(`Model: ${process.env.AI_MODEL || "claude-sonnet-5-5 (default)"}`);

  let t = Date.now();
  const summary = await generateSummary(leadId, "smoke-script");
  console.log(`\n── Summary (${Date.now() - t} ms) ──`);
  console.log(JSON.stringify(summary, null, 2));

  t = Date.now();
  const draft = await generateDraft(
    leadId,
    "smoke-script",
    locale === "hi" || locale === "en" ? locale : undefined,
  );
  console.log(`\n── Draft (${Date.now() - t} ms) ──`);
  console.log(
    `status=${draft.status} reason=${draft.reason} model=${draft.model} locale=${draft.locale}`,
  );
  console.log(draft.text);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
