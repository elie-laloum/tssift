export interface RetryPolicy {
  attempts: number;
  backoff: {
    kind: "exponential" | "linear";
    ceilingMs: number;
  };
}

export interface GetOptions {
  method: "GET";
  headers: Record<string, string>;
}

export interface PostOptions {
  method: "POST";
  headers: Record<string, string>;
  body: string;
  retry: RetryPolicy;
}

export interface StreamOptions {
  method: "STREAM";
  onChunk: (chunk: string) => void;
}

// Three overloads at the same arity: no candidate can be singled out by shape
// alone, which is what makes a failing call report TS2769 rather than the error
// of one specific signature.
export function request(url: string, options: GetOptions): string;
export function request(url: string, options: PostOptions): string;
export function request(url: string, options: StreamOptions): string;
export function request(url: string, _options: GetOptions | PostOptions | StreamOptions): string {
  return url;
}
