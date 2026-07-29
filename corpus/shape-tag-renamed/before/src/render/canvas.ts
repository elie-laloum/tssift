import type { Shape } from "../geometry/shape";

export interface DrawOp {
  op: string;
  args: number[];
}

export function toCanvasOps(s: Shape): DrawOp[] {
  if (s.kind === "circle") {
    return [{ op: "arc", args: [s.x, s.y, s.radius] }];
  }
  if (s.kind === "square") {
    return [{ op: "rect", args: [s.x, s.y, s.side, s.side] }];
  }
  return [{ op: "moveTo", args: [s.x, s.y] }];
}
