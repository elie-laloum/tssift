// Root A — an unresolved module specifier. Nothing in this file is shared with
// src/billing/invoice.ts: no import, no type, no identifier.
import { toCsv } from "@acme/csv-writer";

export function exportRows(rows: ReadonlyArray<Record<string, string>>): string {
  return toCsv(rows);
}
