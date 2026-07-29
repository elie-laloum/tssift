import type { Shape } from "../geometry/shape";

export function groupByVariant(shapes: Shape[]): Record<string, Shape[]> {
  const groups: Record<string, Shape[]> = {};
  for (const s of shapes) {
    const key = s.kind;
    (groups[key] ??= []).push(s);
  }
  return groups;
}
