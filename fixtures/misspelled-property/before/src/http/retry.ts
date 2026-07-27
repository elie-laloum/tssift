import type { HttpResponse } from "./response";

export function shouldRetry(response: HttpResponse): boolean {
  return response.statusCod >= 500;
}
