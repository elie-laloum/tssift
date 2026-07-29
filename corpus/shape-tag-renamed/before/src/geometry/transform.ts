import type { Shape } from "./shape";

// Returns a human-readable note about how a shape would scale.
export function describeScale(s: Shape, factor: number): string {
  switch (s.kind) {
    case "circle":
      return `radius ${s.radius} -> ${s.radius * factor}`;
    case "square":
      return `side ${s.side} -> ${s.side * factor}`;
    case "triangle":
      return `base ${s.base} -> ${s.base * factor}`;
    default:
      return "unchanged";
  }
}
