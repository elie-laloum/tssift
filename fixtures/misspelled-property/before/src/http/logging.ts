import type { HttpResponse } from "./response";

export function logLine(response: HttpResponse): string {
  return `status=${response.statusCod}`;
}
