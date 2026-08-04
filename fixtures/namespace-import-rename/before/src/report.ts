import * as format from "./format";

export function summarize(names: readonly string[]): string {
  return format.joinValues(names.map(format.quote));
}
