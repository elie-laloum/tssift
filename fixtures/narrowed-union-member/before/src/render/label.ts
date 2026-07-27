import type { Shape } from "../geometry/shape";

export function label(shape: Shape): string {
  return `a ${shape.kind}`;
}
