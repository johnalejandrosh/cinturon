/** Join conditional class names. Tiny, dependency-free `clsx` alternative. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
