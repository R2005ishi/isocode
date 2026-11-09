import type { ErrorCode } from "@/types/contracts";

/** Typed API error. Thrown anywhere in a handler/workflow; `withApi` turns it into the contract shape. */
export class ApiErr extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiErr";
  }
}

export const notFound = (what = "Not found") => new ApiErr(404, "NOT_FOUND", what);
export const forbidden = (msg = "You do not have access to this resource") =>
  new ApiErr(403, "FORBIDDEN", msg);
export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new ApiErr(400, "VALIDATION", msg, fields);
export const conflict = (msg: string) => new ApiErr(409, "CONFLICT", msg);
