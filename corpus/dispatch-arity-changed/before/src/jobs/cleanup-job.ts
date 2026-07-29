import { emit } from "../events/dispatch";
import { staleRecordsPurged } from "../events/types";

export function runCleanup(): void {
  const purged = 42;
  emit(staleRecordsPurged(purged));
}
