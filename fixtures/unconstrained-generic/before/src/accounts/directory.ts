import { indexBy } from "../collections/index-by";

export interface User {
  id: string;
  email: string;
}

export function byId(users: User[]): Map<string, User> {
  return indexBy(users, "id");
}
