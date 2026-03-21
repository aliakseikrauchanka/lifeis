/**
 * Parse timestamp from DJI filename format: DJI_13_20251008_215018.WAV
 * Interprets date/time as client's local time (from recording device).
 * @returns ISO date string, or null if parsing fails
 */
export function parseDjiTimestampToIso(filename: string): string | null {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const y = parseInt(year!, 10);
  const m = parseInt(month!, 10) - 1;
  const d = parseInt(day!, 10);
  const h = parseInt(hour!, 10);
  const min = parseInt(minute!, 10);
  const s = parseInt(second!, 10);

  const date = new Date(y, m, d, h, min, s);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
