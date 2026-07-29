import { emit } from "../events/dispatch";
import { digestGenerated } from "../events/types";

export function runDigest(period: string): void {
  emit(digestGenerated(period));
}
