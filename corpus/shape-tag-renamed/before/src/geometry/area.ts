import type { Shape } from "./shape";

export function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.radius ** 2;
    case "square":
      return s.side ** 2;
    case "triangle":
      return 0.5 * s.base * s.height;
    default:
      return 0;
  }
}
