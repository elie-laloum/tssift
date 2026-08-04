/**
 * The root cause. `joinValues` was renamed `joinList` here and nowhere else.
 * Its three readers all reach it through a namespace import, so every failure
 * lands on this module's symbol rather than on a named import.
 */

export function joinList(values: readonly string[], separator = ", "): string {
  return values.join(separator);
}

export function quote(value: string): string {
  return `'${value}'`;
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
