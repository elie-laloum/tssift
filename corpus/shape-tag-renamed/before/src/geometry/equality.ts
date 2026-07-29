import type { Shape } from "./shape";

export function sameVariant(a: Shape, b: Shape): boolean {
  return a.kind === b.kind;
}
