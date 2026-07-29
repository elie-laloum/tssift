import type { Circle, Square, Triangle } from "./shape";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makeCircle(x: number, y: number, radius: number): Circle {
  return { variant: "circle", id: nextId("c"), x, y, radius };
}

export function makeSquare(x: number, y: number, side: number): Square {
  return { variant: "square", id: nextId("s"), x, y, side };
}

export function makeTriangle(x: number, y: number, base: number, height: number): Triangle {
  return { variant: "triangle", id: nextId("t"), x, y, base, height };
}
