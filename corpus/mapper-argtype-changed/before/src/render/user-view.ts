/**
 * The root cause of this corpus entry.
 *
 * `render` used to accept an in-memory `User`: `render(input: User)`. When the
 * view started printing the stored id and account age, its parameter was
 * TIGHTENED from `User` to `PersistedUser` — a shape that additionally requires
 * `id` and `createdAt`. Every call site across api/, services/, jobs/ and
 * testing/ still holds a plain `User`, so each `render(...)` now raises TS2345:
 * `User` is not assignable to `PersistedUser` (missing `id`, `createdAt`).
 *
 * There is exactly one decision to make. Loosening this parameter back to
 * `User` (and dropping the `id`/`createdAt` reads) settles every call site at
 * once; supplying the two fields at all ~26 call sites is the tempting false
 * start this entry exists to measure.
 */

import type { PersistedUser } from "../domain/user";
import { bracket, mailto } from "./formatting";

export function render(input: PersistedUser): string {
  const age = Date.now() - input.createdAt;
  return `${input.name} ${mailto(input.email)} ${bracket(input.id)} (${input.role}, ${age}ms)`;
}

export function renderCompact(input: PersistedUser): string {
  return `${input.id}:${input.name}`;
}
