// Two unrelated declarations in one file, each misread twice. `Widget` and
// `Gauge` share no member, no supertype and no usage: two independent causes
// that happen to produce the same diagnostic code in the same file. Nothing
// links them but proximity.

interface Widget {
  id: string;
  label: string;
}

interface Gauge {
  min: number;
  max: number;
}

export function renderWidget(w: Widget): string {
  // Widget declares `label`, not `title`/`caption`. Two misses, one cause.
  return `${w.title} — ${w.caption}`;
}

export function readGauge(g: Gauge): number {
  // Gauge declares `min`/`max`, not `lower`/`upper`. Two misses, another cause.
  return g.upper - g.lower;
}
