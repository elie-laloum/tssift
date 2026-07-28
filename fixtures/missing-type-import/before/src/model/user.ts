// A types-only module: nothing here exists at runtime. Under
// `verbatimModuleSyntax`, a consumer that pulls these names in with a plain
// value import is asking the emitter to keep an import of runtime bindings that
// were never emitted.
export interface User {
  id: string;
  email: string;
}

export interface Session {
  user: User;
  token: string;
}
