/**
 * The root cause. `locale` was added as a required field of `Profile` when the
 * product went multilingual. The three construction sites below still build the
 * two-field shape.
 */

export interface Profile {
  id: string;
  displayName: string;
  locale: string;
}

export function isComplete(profile: Profile): boolean {
  return profile.displayName.length > 0 && profile.locale.length > 0;
}
