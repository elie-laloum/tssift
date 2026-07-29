// The barrel — and the single root cause of this corpus entry.
//
// It used to be a set of star re-exports:
//
//     export * from "./money";
//     export * from "./registry";
//     export * from "./catalog";
//
// During a tidy-up the stars were replaced with explicit named re-exports so
// the public surface would be legible at a glance. `Money` was simply missed:
// `./money` still exports it, but this barrel no longer does.
//
// Nothing here is a type error — the barrel is valid TypeScript. The many
// modules that `import { Money } from "../domain"` are where the compiler
// complains (TS2305: has no exported member 'Money'). Re-adding the one line
// settles all of them; no importer and no underlying module needs to change.

export type { CatalogItem, Sku } from "./catalog";
export type { RegistryEntry } from "./registry";
export { Registry } from "./registry";
