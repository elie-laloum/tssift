import { Session } from "./session";

export function authorize(session: Session): string {
  return session.token;
}

export function refreshHeader(session: Session): string {
  return `Bearer ${session.token}`;
}
