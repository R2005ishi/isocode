import type { ApiError, ErrorCode } from "@/types/contracts";

/** Error thrown by `api()` — carries the contract error code + message for toasts. */
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

/** JSON fetch against our own `/api/*` routes; throws `ApiClientError` on non-2xx. */
export async function api<T>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "NETWORK", "Network error — check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data as ApiError | null)?.error;
    if (res.status === 401 && typeof window !== "undefined") {
      // Session expired: send the user back to sign in, then here.
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
    }
    throw new ApiClientError(
      res.status,
      e?.code ?? "INTERNAL",
      e?.message ?? `Request failed (${res.status})`,
      e?.fields,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
