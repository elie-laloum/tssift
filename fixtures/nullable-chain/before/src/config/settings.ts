/**
 * The root cause. `proxy` became nullable when proxy support was made optional,
 * and the three readers below still dereference it directly.
 */

export interface ProxyConfig {
  host: string;
  port: number;
}

export interface Settings {
  endpoint: string;
  proxy: ProxyConfig | null;
}

export function loadSettings(): Settings {
  return { endpoint: "https://example.invalid", proxy: null };
}
