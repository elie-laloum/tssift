/**
 * The declarative list of diagnostic codes for which a source resolves a
 * `DiagnosticContext` at ingestion.
 *
 * Deliberately EMPTY in P0. Nothing consumes `context` before P1/P2, and
 * resolving `SymbolRef`s without a consumer would buy speculative work at the
 * price of one checker round-trip per diagnostic — on a monorepo, ten thousand
 * of them for nothing.
 *
 * What P0 does ship is the mechanism: the source takes this list, honours it,
 * and P1 adds numbers here without touching `sources/`. The source knows codes,
 * never enrichers.
 *
 * The list this will grow into is PROJECT.md §5.2 — the same table that drives
 * the enrichers, which is why it lives in one declarative place.
 */
export const CONTEXT_CAPTURE_CODES: readonly number[] = [];
