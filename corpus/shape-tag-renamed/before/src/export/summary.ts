import type { Shape } from "../geometry/shape";

export function summarize(s: Shape): string {
  switch (s.kind) {
    case "circle":
      return `circle(${s.radius})`;
    case "square":
      return `square(${s.side})`;
    case "triangle":
      return `triangle(${s.base}x${s.height})`;
    default:
      return "unknown";
  }
}
