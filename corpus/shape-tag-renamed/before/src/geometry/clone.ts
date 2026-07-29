import type { Shape } from "./shape";

// Reports whether a shape carries triangle-only measurements.
export function hasTriangleMetrics(s: Shape): boolean {
  if (s.kind === "triangle") {
    return s.base > 0 && s.height > 0;
  }
  return false;
}
