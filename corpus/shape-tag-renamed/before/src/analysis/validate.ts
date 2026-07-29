import type { Shape } from "../geometry/shape";

export function isValid(s: Shape): boolean {
  switch (s.kind) {
    case "circle":
      return s.radius > 0;
    case "square":
      return s.side > 0;
    case "triangle":
      return s.base > 0 && s.height > 0;
    default:
      return false;
  }
}
