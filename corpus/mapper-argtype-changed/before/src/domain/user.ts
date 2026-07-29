/**
 * The two user shapes of this project.
 *
 * `User` is the in-memory value the rest of the code passes around: a name, an
 * email and a role, all well-formed. `PersistedUser` is what a `User` becomes
 * once it has been written to storage — it carries the two fields storage
 * assigns, `id` and `createdAt`.
 *
 * Nothing in this file is broken. The single defect of this corpus entry lives
 * in ../render/user-view: `render` was tightened to demand a `PersistedUser`,
 * while every caller still holds a plain `User`.
 */

import type { Role } from "./role";

export interface User {
  name: string;
  email: string;
  role: Role;
}

export interface PersistedUser extends User {
  id: string;
  createdAt: number;
}
