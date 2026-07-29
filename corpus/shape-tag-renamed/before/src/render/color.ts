import type { Shape } from "../geometry/shape";

export function fillColor(s: Shape): string {
  if (s.kind === "circle") {
    return "#e11d48";
  }
  if (s.kind === "square") {
    return "#16a34a";
  }
  return "#2563eb";
}
