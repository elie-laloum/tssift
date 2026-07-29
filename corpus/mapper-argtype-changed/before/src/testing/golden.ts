import { makeUser } from "../domain/user-factory";
import { render } from "../render/user-view";

export function goldenLine(): string {
  const user = makeUser("Golden", "golden@example.test", "member");
  return render(user);
}
