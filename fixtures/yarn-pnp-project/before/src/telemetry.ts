import { request } from "@acme/http";

export async function sendEvent(name: string, payload: string): Promise<string> {
  return request(`/api/events/${name}`, { method: "POST", body: payload });
}
