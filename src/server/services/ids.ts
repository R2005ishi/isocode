/**
 * Human-friendly references read out over the phone, e.g. TD-7K2Q9. Server-only (node:crypto).
 */
import { randomInt } from "node:crypto";

/** No 0/O or 1/I — they get confused when read aloud or typed from a WhatsApp message. */
export const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** ASSUMPTION: 5 characters (32^5 ≈ 33.5 M combinations); uniqueness is enforced by the DB. */
const REFERENCE_LENGTH = 5;

export function makeReference(prefix: "TD" | "EN"): string {
  let s = "";
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    s += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return `${prefix}-${s}`;
}
