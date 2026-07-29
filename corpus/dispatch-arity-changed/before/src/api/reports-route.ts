import { emit } from "../events/dispatch";
import { reportExported } from "../events/types";

export function exportReport(reportId: string): void {
  emit(reportExported(reportId));
}
