import type { Settings } from "../config/settings";

export function healthTarget(settings: Settings): number {
  return settings.proxy.port;
}
