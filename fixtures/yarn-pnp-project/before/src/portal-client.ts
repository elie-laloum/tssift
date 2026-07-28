import { request } from "@acme/http";
import { authHeader, type Session } from "./session";

export async function fetchProfile(session: Session): Promise<string> {
  return request("/api/profile", { method: "GET", headers: authHeader(session) });
}
