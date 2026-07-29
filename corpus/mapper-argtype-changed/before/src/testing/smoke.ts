import { render, renderCompact } from "../render/user-view";
import { sampleAdmin, sampleUsers } from "./fixtures";

export function smokeRenderOne(): string {
  return render(sampleAdmin);
}

export function smokeRenderMany(): string[] {
  return sampleUsers.map((user) => renderCompact(user));
}
