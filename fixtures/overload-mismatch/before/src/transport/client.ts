import { request } from "./request";

export function createUser(body: string): string {
  return request("/v1/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    retry: {
      attempts: 3,
      backoff: { kind: "exponentail", ceilingMs: 30_000 },
    },
  });
}
