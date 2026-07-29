import { emit } from "../events/dispatch";
import { accountCreated, accountDeleted } from "../events/types";

export function createAccount(userId: string): void {
  // ... persist the account ...
  emit(accountCreated(userId));
}

export function deleteAccount(userId: string): void {
  // ... tombstone the account ...
  emit(accountDeleted(userId));
}
