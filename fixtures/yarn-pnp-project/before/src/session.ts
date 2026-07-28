export interface Session {
  token: string;
  expiresAt: number;
}

export function authHeader(session: Session): Record<string, string> {
  return { authorization: `Bearer ${session.token}` };
}
