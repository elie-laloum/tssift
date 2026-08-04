import * as format from "./format";

export function auditLine(fields: readonly string[]): string {
  return format.truncate(format.joinValues(fields, " | "), 80);
}
