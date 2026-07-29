import type { Shape } from "../geometry/shape";

export function labelOf(s: Shape): string {
  switch (s.kind) {
    case "circle":
      return "Circle";
    case "square":
      return "Square";
    case "triangle":
      return "Triangle";
    default:
      return "Shape";
  }
}
