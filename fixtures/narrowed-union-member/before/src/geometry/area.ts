import type { Shape } from "./shape";

export function area(shape: Shape): number {
  if (shape.kind === "circle") return Math.PI * shape.radius ** 2;
  if (shape.kind === "square") return shape.side ** 2;
  return (shape.base * shape.height) / 2;
}
