/**
 * Minimal RFC 4180 CSV parser [client-safe, pure].
 * Handles: quoted fields, escaped quotes (""), commas/newlines inside quotes, CRLF / LF / CR line
 * endings, a leading UTF-8 BOM, and a trailing newline. Blank lines are dropped.
 */

export class CsvParseError extends Error {
  constructor(
    message: string,
    public line: number,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

export function parseCsv(text: string, delimiter = ","): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false; // distinguishes `""` (empty quoted) from nothing at all
  let line = 1;
  let quoteOpenedOnLine = 1;

  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    // Drop fully blank lines (a single empty field).
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n" || (ch === "\r" && src[i + 1] !== "\n")) line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted && field === "") {
      inQuotes = true;
      fieldStarted = true;
      quoteOpenedOnLine = line;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
      line++;
    } else {
      // Lenient: text after a closing quote, or a stray quote mid-field, is kept literally.
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes)
    throw new CsvParseError(
      `Unclosed quote starting on line ${quoteOpenedOnLine}`,
      quoteOpenedOnLine,
    );
  if (field !== "" || fieldStarted || row.length > 0) endRow();
  return rows;
}

/** "Customer Name " → "customername"; "E-mail" → "email". */
export function normaliseHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Quotes a value for CSV output when needed. */
export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
