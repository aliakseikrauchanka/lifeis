/**
 * Normalizes a saved translation value.
 * Trim -> strip one trailing period (not ? or !) -> capitalize first letter.
 * The rest of the string is left untouched. Idempotent.
 */
export function formatEntry(value: string): string {
  let s = value.trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd();
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
