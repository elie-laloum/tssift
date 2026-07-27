import type { Shape } from "../geometry/shape";

export function legend(shapes: Shape[]): string {
  return shapes.map((shape) => shape.kind).join(", ");
}
