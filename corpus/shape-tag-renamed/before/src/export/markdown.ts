import type { Shape } from "../geometry/shape";

export function toMarkdownItem(s: Shape): string {
  return `- **${s.kind}** at (${s.x}, ${s.y})`;
}
