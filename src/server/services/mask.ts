/**
 * Masking helpers. [client-safe]
 * The full registration number must never leave the server — mask before building any DTO.
 */

const DOT = "•";

/**
 * `UP32AB1282` / `up-32 ab 1282` → `UP32 •• ••82`.
 * Keeps state + RTO code (first 4) and the last 2 characters. Anything shorter than 6 characters
 * after normalising is treated as malformed: only the last 2 are shown, never the whole string.
 */
export function maskRegistration(reg: string): string {
  const s = (reg ?? "").replace(/[\s-]/g, "").toUpperCase();
  if (s.length < 6) {
    return `${DOT}${DOT} ${DOT}${DOT}${s.length >= 3 ? s.slice(-2) : ""}`;
  }
  return `${s.slice(0, 4)} ${DOT}${DOT} ${DOT}${DOT}${s.slice(-2)}`;
}

/**
 * `9800000001` → `98•••••001`. Keeps the first 2 and last 3 digits; the middle is replaced
 * one-for-one so the length still reads like a phone number. Too-short input is fully masked.
 */
export function maskPhone(phone: string): string {
  const s = (phone ?? "").replace(/[\s-]/g, "").replace(/^\+?91(?=\d{10}$)/, "");
  if (s.length < 6) return DOT.repeat(Math.max(s.length, 3));
  return `${s.slice(0, 2)}${DOT.repeat(s.length - 5)}${s.slice(-3)}`;
}
