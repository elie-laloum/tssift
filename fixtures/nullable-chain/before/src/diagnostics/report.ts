import type { Settings } from "../config/settings";

export function describeProxy(settings: Settings): string {
  return `proxy host is ${settings.proxy.host}`;
}
