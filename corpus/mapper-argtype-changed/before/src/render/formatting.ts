/**
 * Presentation helpers shared by the user renderer. Pure string work; unrelated
 * to the defect.
 */

export function bracket(label: string): string {
  return `[${label}]`;
}

export function mailto(email: string): string {
  return `<${email}>`;
}
