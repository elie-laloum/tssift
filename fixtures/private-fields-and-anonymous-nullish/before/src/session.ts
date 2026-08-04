/**
 * Two things at once, both of which needed a real compiler to observe.
 *
 * `Session` carries more ECMAScript private fields than public ones, so a
 * property list that did not filter them would spend its display budget on
 * names no caller can write. `token` was renamed `accessToken` here only.
 */

export class Session {
  #secret = "";
  #refresh = "";
  #issuedAt = 0;
  #expiresAt = 0;
  #attempts = 0;

  accessToken = "";
  userId = "";

  renew(): void {
    this.#attempts += 1;
  }
}

/** Returns a fresh object every call, so the result has no name to print. */
export function currentProfile(): { contact: { email: string } | null } {
  return { contact: null };
}
