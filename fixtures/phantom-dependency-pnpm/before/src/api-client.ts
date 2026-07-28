import { request } from "@acme/http";
import { stringify } from "qs";

export async function getJson(url: string, query: Record<string, unknown>): Promise<string> {
  return request(`${url}?${stringify(query)}`, { method: "GET" });
}
