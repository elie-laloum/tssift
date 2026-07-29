import type { Shape } from "./shape";

export function perimeter(s: Shape): number {
  if (s.kind === "circle") {
    return 2 * Math.PI * s.radius;
  }
  if (s.kind === "square") {
    return 4 * s.side;
  }
  return s.base + 2 * Math.hypot(s.base / 2, s.height);
}
