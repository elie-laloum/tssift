import { parse } from "qs";

export function callbackParams(search: string): Record<string, unknown> {
  return parse(search.replace(/^\?/, ""));
}
