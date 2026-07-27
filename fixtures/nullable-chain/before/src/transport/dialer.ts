import type { Settings } from "../config/settings";

export function dial(settings: Settings): string {
  return `${settings.proxy.host}:${settings.proxy.port}`;
}
