/**
 * The root cause. The discriminated union's tag was renamed from `kind` to
 * `type` across all three members. The three consumers below still narrow on
 * `kind`, and each of them reads a member property afterwards.
 */

export type Shape =
  | { type: "circle"; radius: number }
  | { type: "square"; side: number }
  | { type: "triangle"; base: number; height: number };

export function unitCircle(): Shape {
  return { type: "circle", radius: 1 };
}
