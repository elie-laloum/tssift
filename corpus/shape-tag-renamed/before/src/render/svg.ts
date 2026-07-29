import type { Shape } from "../geometry/shape";

export function toSvg(s: Shape): string {
  switch (s.kind) {
    case "circle":
      return `<circle cx="${s.x}" cy="${s.y}" r="${s.radius}" />`;
    case "square":
      return `<rect x="${s.x}" y="${s.y}" width="${s.side}" height="${s.side}" />`;
    case "triangle": {
      const half = s.base / 2;
      return `<polygon points="${s.x - half},${s.y} ${s.x + half},${s.y} ${s.x},${s.y - s.height}" />`;
    }
    default:
      return "";
  }
}
