import type { Shape } from "../geometry/shape";

export function histogram(shapes: Shape[]): Map<string, number> {
  const hist = new Map<string, number>();
  for (const s of shapes) {
    const key = s.kind;
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  return hist;
}
