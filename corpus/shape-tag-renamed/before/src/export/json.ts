import type { Shape } from "../geometry/shape";

export function toJson(s: Shape): string {
  const tag = s.kind;
  return JSON.stringify({ tag, id: s.id, x: s.x, y: s.y });
}
