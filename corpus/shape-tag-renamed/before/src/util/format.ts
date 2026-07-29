export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function pad(label: string, width: number): string {
  return label.padEnd(width, " ");
}
