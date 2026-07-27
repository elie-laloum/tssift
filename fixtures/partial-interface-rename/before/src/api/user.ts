import type { CreateUserInput, UserRecord } from "../types/user";

const store = new Map<string, UserRecord>();

/** Call site 1 — leftover field on an object literal in a typed position. */
export function draftUser(id: string): CreateUserInput {
  return {
    id,
    email: "unset@example.com",
    emailAddress: "unset@example.com",
  };
}

/** Call site 2 — read of the old field name. */
export function contactOf(input: CreateUserInput): string {
  return input.emailAddress;
}

export function persist(input: CreateUserInput): void {
  store.set(input.id, { ...input, createdAt: "1970-01-01T00:00:00.000Z" });
}

/** Call site 3 — a widened value, so the failure is plain assignability. */
const legacySeed = {
  id: "u_seed",
  emailAddress: "seed@example.com",
};

export function seed(): void {
  persist(legacySeed);
}
