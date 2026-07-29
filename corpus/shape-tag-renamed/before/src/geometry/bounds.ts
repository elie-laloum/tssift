import type { Shape } from "./shape";

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(s: Shape): Box {
  switch (s.kind) {
    case "circle":
      return {
        minX: s.x - s.radius,
        minY: s.y - s.radius,
        maxX: s.x + s.radius,
        maxY: s.y + s.radius,
      };
    case "square":
      return {
        minX: s.x,
        minY: s.y,
        maxX: s.x + s.side,
        maxY: s.y + s.side,
      };
    default:
      return { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
  }
}
