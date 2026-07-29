import type { Shape } from "./shape";

const store = new Map<string, Shape>();

export function register(shape: Shape): void {
  store.set(shape.id, shape);
}

export function get(id: string): Shape | undefined {
  return store.get(id);
}

export function all(): Shape[] {
  return [...store.values()];
}

export function clear(): void {
  store.clear();
}
