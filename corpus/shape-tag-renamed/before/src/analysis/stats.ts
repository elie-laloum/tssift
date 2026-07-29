import type { Shape } from "../geometry/shape";

export interface VariantCounts {
  circle: number;
  square: number;
  triangle: number;
}

export function countByVariant(shapes: Shape[]): VariantCounts {
  const counts: VariantCounts = { circle: 0, square: 0, triangle: 0 };
  for (const s of shapes) {
    if (s.kind === "circle") {
      counts.circle += 1;
    } else if (s.kind === "square") {
      counts.square += 1;
    } else {
      counts.triangle += 1;
    }
  }
  return counts;
}
