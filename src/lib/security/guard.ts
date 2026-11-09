import { Prisma } from "@prisma/client";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ApiError, Role } from "@/types/contracts";
import { PriceNotPublishedError } from "@/server/services/pricing";
import { ApiErr } from "./errors";
import { clientIp, rateLimit } from "./rate-limit";

export { ApiErr } from "./errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  showroomId: string | null;
};

/**
 * Requires a signed-in, ACTIVE user with one of `roles` (any role if none given).
 * Role and active flag are re-read from the DB so a demoted/deactivated user loses access
 * immediately, not when their JWT expires.
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiErr(401, "UNAUTHENTICATED", "Please sign in");
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, showroomId: true, isActive: true },
  });
  if (!user || !user.isActive) throw new ApiErr(401, "UNAUTHENTICATED", "Please sign in");
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new ApiErr(403, "FORBIDDEN", "You do not have access to this resource");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    showroomId: user.showroomId,
  };
}

/** Throws 429 RATE_LIMITED when the caller's IP exceeds `limit` calls per window on `route`. */
export function enforceRateLimit(req: Request, route: string, limit = 10, windowMs = 60_000) {
  // ASSUMPTION: 10 public form submissions per minute per IP per route.
  if (!rateLimit(`${route}:${clientIp(req)}`, limit, windowMs)) {
    throw new ApiErr(429, "RATE_LIMITED", "Too many requests. Please wait a minute and try again.");
  }
}

/** Reads and parses a JSON body, 400 on malformed JSON. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiErr(400, "VALIDATION", "Request body must be valid JSON");
  }
}

export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  return schema.parse(await readJson(req));
}

export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  return schema.parse(params);
}

/** DPDP: a missing/false consent gets its own error code, checked before generic validation. */
export function requireConsent(body: unknown) {
  const consent = (body as { consent?: unknown } | null)?.consent;
  if (consent !== true) {
    throw new ApiErr(400, "CONSENT_REQUIRED", "Please give consent so we can contact you", {
      consent: "Please give consent so we can contact you",
    });
  }
}

export function errorJson(status: number, error: ApiError["error"]) {
  return Response.json({ error } satisfies ApiError, { status });
}

function zodFields(e: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof ApiErr) {
    return errorJson(e.status, {
      code: e.code,
      message: e.message,
      ...(e.fields ? { fields: e.fields } : {}),
    });
  }
  if (e instanceof ZodError) {
    return errorJson(400, {
      code: "VALIDATION",
      message: "Please check the highlighted fields",
      fields: zodFields(e),
    });
  }
  if (e instanceof PriceNotPublishedError) {
    return errorJson(404, { code: "PRICE_NOT_PUBLISHED", message: e.message });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = ([] as string[])
        .concat((e.meta?.target as string[] | string | undefined) ?? [])
        .join(", ");
      return errorJson(409, {
        code: "CONFLICT",
        message: `A record with this ${target || "value"} already exists`,
      });
    }
    if (e.code === "P2025") return errorJson(404, { code: "NOT_FOUND", message: "Not found" });
    if (e.code === "P2003")
      return errorJson(400, { code: "VALIDATION", message: "A referenced record does not exist" });
  }
  // Agent C's AiLeadNotFoundError and similar carry status/code.
  if (e instanceof Error && (e as { code?: unknown }).code === "NOT_FOUND") {
    return errorJson(404, { code: "NOT_FOUND", message: e.message });
  }
  console.error("[api] unhandled error", e);
  return errorJson(500, { code: "INTERNAL", message: "Something went wrong. Please try again." });
}

/**
 * Wraps a route handler: anything it returns that is not a Response is sent as JSON (200);
 * any thrown error is mapped to the `{ error: { code, message, fields? } }` contract.
 */
export function withApi<C = unknown>(handler: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const out = await handler(req, ctx);
      return out instanceof Response ? out : Response.json(out);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

/** Route context helper for Next 15 (params is a Promise). */
export type IdCtx = { params: Promise<{ id: string }> };
