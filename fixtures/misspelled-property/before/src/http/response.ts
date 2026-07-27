/**
 * The root cause is a typo, not a change: `statusCode` is spelled correctly
 * here and misspelled `statusCod` at the two call sites, which were written by
 * copying one another.
 */

export interface HttpResponse {
  statusCode: number;
  body: string;
}

export function ok(body: string): HttpResponse {
  return { statusCode: 200, body };
}
