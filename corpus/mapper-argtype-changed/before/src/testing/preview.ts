import { render } from "../render/user-view";
import { sampleAdmin, sampleGuest, sampleMember } from "./fixtures";

export function previewAll(): string[] {
  return [render(sampleAdmin), render(sampleMember), render(sampleGuest)];
}
