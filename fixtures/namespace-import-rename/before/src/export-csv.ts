import * as format from "./format";

export function row(cells: readonly string[]): string {
  return format.joinValues(cells, ",");
}

export function header(columns: readonly string[]): string {
  return format.joinValues(columns, ",");
}
