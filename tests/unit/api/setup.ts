/**
 * Points Prisma at the TEST database before `@/lib/db` is imported, and (re)seeds it.
 * Import this FIRST in every API test file. Refuses to run against anything that is not a *_test DB,
 * so brandx_dev is never touched.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");

function fromDotEnv(name: string): string | undefined {
  try {
    const line = readFileSync(path.join(root, ".env"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line
      ?.slice(name.length + 1)
      .trim()
      .replace(/^"|"$/g, "");
  } catch {
    return undefined;
  }
}

const url = process.env.TEST_DATABASE_URL ?? fromDotEnv("TEST_DATABASE_URL");
if (!url || !/_test(\?|$)/.test(url)) {
  throw new Error(
    "API tests need TEST_DATABASE_URL pointing at a *_test database (e.g. brandx_test).",
  );
}
process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ??= "test-secret";
// Force the AI mock provider: tests never call the real LLM.
process.env.ANTHROPIC_API_KEY = "";

/** Applies migrations and runs the idempotent seed against the test DB. */
export function resetTestDb() {
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { cwd: root, env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { cwd: root, env, stdio: "pipe" });
}
