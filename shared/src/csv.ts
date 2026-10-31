// Builds CSV text for downloads (History tab). Used by the app; tested in server/test/csv.test.ts.
// - Starts with a byte order mark so Excel reads accents and non-English text correctly.
// - Quotes every cell that needs it (comma, quote, line break).
// - A cell that starts with = + - @ or a tab is prefixed with ' so Excel shows it as text and never runs it as a
//   formula. Remarks come from uploaded sheets, so they are not trusted (D-046).

export type CsvCell = string | number | null | undefined;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
