/**
 * The root cause. `K` lost its `extends keyof T` constraint, so `T[K]` is no
 * longer a legal index. Unlike every other fixture here, the declaration itself
 * fails to compile — the diagnostics are ON the cause, not only around it.
 */

export function indexBy<T, K>(items: T[], key: K): Map<T[K], T> {
  const out = new Map<T[K], T>();
  for (const item of items) out.set(item[key], item);
  return out;
}
