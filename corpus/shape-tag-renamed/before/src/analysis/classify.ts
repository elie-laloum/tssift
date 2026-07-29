import type { Shape } from "../geometry/shape";

export function isRound(s: Shape): boolean {
  return s.kind === "circle";
}

export function isPolygon(s: Shape): boolean {
  return s.kind === "square" || s.kind === "triangle";
}
