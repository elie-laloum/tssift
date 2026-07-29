/**
 * Reusable in-memory `User` fixtures. Each is a complete, well-formed `User`;
 * none carries `id` or `createdAt`, because these never went through storage.
 */

import type { User } from "../domain/user";

export const sampleAdmin: User = {
  name: "Ada Byron",
  email: "ada@example.test",
  role: "admin",
};

export const sampleMember: User = {
  name: "Grace Hopper",
  email: "grace@example.test",
  role: "member",
};

export const sampleGuest: User = {
  name: "Guest",
  email: "guest@example.test",
  role: "guest",
};

export const sampleUsers: User[] = [sampleAdmin, sampleMember, sampleGuest];
