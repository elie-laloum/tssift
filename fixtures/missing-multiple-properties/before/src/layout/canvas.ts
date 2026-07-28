import { Rect } from "../geometry/shape";

// Three construction sites, each missing the same two required members —
// `width` and `height`. TypeScript reports two-or-more missing as TS2739, one
// missing as TS2741.
export const origin: Rect = { x: 0, y: 0 };

export function corner(): Rect {
  return { x: 10, y: 10 };
}

export const cursor: Rect = { x: 1, y: 1 };
