import { request } from "@acme/http";
import { stringify } from "qs";

export async function upload(url: string, fields: Record<string, unknown>): Promise<string> {
  return request(url, { method: "POST", body: stringify(fields) });
}
