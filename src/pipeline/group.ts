/**
 * Ranking and declassing — what the renderers walk (PROJECT.md §5.1).
 *
 * **Declassing is a property of the rendering, never of the data** (rule 2).
 * Nothing here removes a diagnostic; `DiagnosticReport.diagnostics` stays whole
 * and this module only decides what gets a line and in which order. That is what
 * makes `--all` honest by construction rather than by vigilance.
 *
 * Order is "by explanatory power": groups first, largest first, then lone
 * diagnostics in source order. The first thing an agent reads has to be the
 * thing that explains the most — that sentence is the entire product.
 */
import type { DiagnosticGroup, DiagnosticReport, EnrichedDiagnostic } from "../types.js";

/**
 * Sites shown in full under a group header before the counter takes over
 * (§5.1 rule 4: "three sites then `+37 other usages`").
 */
export const MAX_SHOWN_MEMBERS = 3;

/** A group, resolved to the diagnostics it indexes, ready to render. */
export interface GroupEntry {
  kind: "group";
  group: DiagnosticGroup;
  /** Every member, in report order. The cap is applied by the renderer, not here. */
  members: EnrichedDiagnostic[];
}

export interface DiagnosticEntry {
  kind: "diagnostic";
  diagnostic: EnrichedDiagnostic;
}

export type Entry = GroupEntry | DiagnosticEntry;

/**
 * The ordered entries a report renders as.
 *
 * With `all`, every diagnostic is its own entry in source order and no group is
 * emitted: `--all` restores each diagnostic to a full line, ungrouped (§5.1).
 * The grouping still *happened* — `role` and `group` are still on every
 * diagnostic in json — it is only the rendering that is flattened.
 */
export function entriesOf(report: DiagnosticReport, all: boolean): Entry[] {
  if (all) {
    return report.diagnostics.map((diagnostic) => ({ kind: "diagnostic", diagnostic }));
  }

  const byId = new Map(report.diagnostics.map((diagnostic) => [diagnostic.id, diagnostic]));
  const grouped = new Set<string>();
  const entries: Entry[] = [];

  // `report.groups` arrives ranked by explanatory power from causality.ts.
  for (const group of report.groups) {
    const members = group.members
      .map((id) => byId.get(id))
      .filter((member): member is EnrichedDiagnostic => member !== undefined);
    if (members.length === 0) continue;

    for (const member of members) grouped.add(member.id);
    entries.push({ kind: "group", group, members });
  }

  // Everything a group did not claim keeps its own line, in the source's order.
  // This is the half of rule 2 that is easy to lose: a diagnostic with no cause
  // is not less important, it is merely unexplained.
  for (const diagnostic of report.diagnostics) {
    if (grouped.has(diagnostic.id)) continue;
    entries.push({ kind: "diagnostic", diagnostic });
  }

  return entries;
}

/** How many diagnostics an entry accounts for — used for the summary line. */
export function sizeOf(entry: Entry): number {
  return entry.kind === "group" ? entry.members.length : 1;
}
