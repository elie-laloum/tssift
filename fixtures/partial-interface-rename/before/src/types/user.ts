/**
 * Input contract for user creation.
 *
 * `emailAddress` was renamed to `email` in this file. The rename landed on the
 * declaration but not on every call site — that partial state is the fixture.
 */
export interface CreateUserInput {
  id: string;
  email: string;
  name?: string;
}

export interface UserRecord extends CreateUserInput {
  createdAt: string;
}
