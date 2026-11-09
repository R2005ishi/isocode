import type { ApiError, ErrorCode } from "@/types/contracts";

/** Error thrown by the public fetch helpers; mirrors the API's `{ error: {...} }` shape. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | "NETWORK",
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "INTERNAL", err?.message ?? res.statusText, err?.fields);
  }
  return data as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "Network error");
  }
  return handle<T>(res);
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK", "Network error");
  }
  return handle<T>(res);
}

const KNOWN = new Set([
  "RATE_LIMITED",
  "VALIDATION",
  "CONSENT_REQUIRED",
  "SLOT_TAKEN",
  "SLOT_INVALID",
  "OPTED_OUT",
  "NOT_FOUND",
  "PRICE_NOT_PUBLISHED",
  "INTERNAL",
]);

/** Translation key under `errors.*` for any thrown error. */
export function errorKey(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === "NETWORK") return "network";
    if (KNOWN.has(e.code)) return e.code;
  }
  return "generic";
}
