import type { Shape } from "../geometry/shape";

export function toCsvRow(s: Shape): string {
  return [s.id, s.kind, s.x, s.y].join(",");
}

export function csvHeader(): string {
  return "id,variant,x,y";
}
