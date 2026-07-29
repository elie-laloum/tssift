import { emit } from "../events/dispatch";
import { ledgerReconciled } from "../events/types";

export function runReconcile(batchId: string): void {
  emit(ledgerReconciled(batchId));
}
