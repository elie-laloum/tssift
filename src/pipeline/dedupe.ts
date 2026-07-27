/**
 * Strict de-duplication — the only stage in the pipeline allowed to *remove* a
 * diagnostic rather than declass it (rule 2).
 *
 * **Measured before it was written**, as the plan required. On the three
 * contract fixtures and the three real-corpus entries — 283 diagnostics under
 * TypeScript 5.9.3, 2026-07-27 — the duplicate rate is **zero**. Not "low":
 * zero, by `id` and by full payload alike.
 *
 * So this is deliberately small. What would have been wrong is a machinery of
 * near-identity heuristics: "same code, same line, similar message" is precisely
 * the resemblance-based reasoning §5.1 forbids, and it would collapse two real
 * errors into one at the very layer that has no way of noticing.
 *
 * What it is *not* is trivial in its contract, and that is worth spelling out:
 *
 * **An identical `id` is not sufficient grounds for removal.** `id` is
 * `sha256(code|file|line|col|message)` (§4). It covers neither `related`, nor
 * `chain`, nor `context`. Two diagnostics can therefore share an `id` while
 * carrying different information — one with a resolved `declaredAt`, one
 * without. Dropping either would lose exactly what P1 needs. So the identity
 * used below is the **whole payload**, and `id` serves only to bucket
 * candidates cheaply.
 *
 * Order is preserved and the first occurrence wins, so the stage is
 * deterministic and its output order is still the source's.
 */
import type { NormalizedDiagnostic, ProgramFacts } from "../types.js";

/**
 * Canonical form of a diagnostic, for equality only.
 *
 * `JSON.stringify` is key-order dependent, which is normally a reason not to use
 * it for equality — here it is safe because every diagnostic in the array comes
 * out of a single `normalize` function that builds its object literal the same
 * way every time. Comparison happens *within* an `id` bucket, so two diagnostics
 * are only ever compared when they already agree on code, file, position and
 * message.
 */
function payloadOf(diagnostic: NormalizedDiagnostic): string {
  return JSON.stringify(diagnostic);
}

/**
 * Drop byte-identical duplicates, keep everything else, preserve order.
 *
 * `facts` is unused today and is still in the signature on purpose: every stage
 * has the same shape, so adding one never means changing a call site.
 */
export function dedupe(
  diagnostics: readonly NormalizedDiagnostic[],
  _facts: ProgramFacts,
): NormalizedDiagnostic[] {
  const seen = new Map<string, Set<string>>();
  const kept: NormalizedDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    let bucket = seen.get(diagnostic.id);
    if (!bucket) {
      bucket = new Set();
      seen.set(diagnostic.id, bucket);
    }

    const payload = payloadOf(diagnostic);
    if (bucket.has(payload)) continue;

    bucket.add(payload);
    kept.push(diagnostic);
  }

  return kept;
}
