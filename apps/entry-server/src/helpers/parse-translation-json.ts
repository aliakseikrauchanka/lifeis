const MAX_FIELD_LENGTH = 500;
const MAX_CORRECTED_LENGTH = 2000;
const MAX_COLUMNS = 6;
const MAX_ROWS = 20;
const MAX_CELLS = 6;
const MAX_TRANSLATIONS = 5;
const MAX_EXAMPLES = 5;

export interface InflectionTable {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface ProviderExplanation {
  partOfSpeech: string;
  inflection: InflectionTable | null;
  note: string | null;
}

export interface ProviderCorrection {
  corrected: string;
  what: string;
  why: string;
}

export interface ParsedTranslation {
  translations: string[];
  examples: Array<{ original: string; translated: string }>;
  explanation: ProviderExplanation | null;
  correction: ProviderCorrection | null;
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s);
const isNonEmpty = (x: unknown): x is string => isStr(x) && x.trim().length > 0;

function parseInflection(raw: unknown): InflectionTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { title?: unknown; columns?: unknown; rows?: unknown };
  if (!isStr(r.title)) return null;
  if (!Array.isArray(r.columns) || !r.columns.every(isStr)) return null;
  if (!Array.isArray(r.rows)) return null;
  const rows = r.rows
    .filter(
      (row: unknown): row is { label: string; cells: string[] } =>
        !!row &&
        typeof row === 'object' &&
        isStr((row as { label?: unknown }).label) &&
        Array.isArray((row as { cells?: unknown }).cells) &&
        (row as { cells: unknown[] }).cells.every(isStr),
    )
    .slice(0, MAX_ROWS)
    .map((row) => ({
      label: truncate(row.label, MAX_FIELD_LENGTH),
      cells: row.cells.slice(0, MAX_CELLS).map((c) => truncate(c, MAX_FIELD_LENGTH)),
    }));
  return {
    title: truncate(r.title, MAX_FIELD_LENGTH),
    columns: r.columns.slice(0, MAX_COLUMNS).map((c) => truncate(c, MAX_FIELD_LENGTH)),
    rows,
  };
}

function parseExplanation(raw: unknown): ProviderExplanation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { partOfSpeech?: unknown; inflection?: unknown; note?: unknown };
  if (!isNonEmpty(r.partOfSpeech)) return null;
  return {
    partOfSpeech: truncate(r.partOfSpeech, MAX_FIELD_LENGTH),
    inflection: parseInflection(r.inflection),
    note: isStr(r.note) ? truncate(r.note, MAX_FIELD_LENGTH) : null,
  };
}

function parseCorrection(raw: unknown): ProviderCorrection | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { corrected?: unknown; what?: unknown; why?: unknown };
  if (!isNonEmpty(r.corrected) || !isNonEmpty(r.what) || !isNonEmpty(r.why)) return null;
  return {
    corrected: truncate(r.corrected, MAX_CORRECTED_LENGTH),
    what: truncate(r.what, MAX_FIELD_LENGTH),
    why: truncate(r.why, MAX_FIELD_LENGTH),
  };
}

export function parseTranslationJson(raw: string): ParsedTranslation {
  const parsed = JSON.parse(raw);
  return {
    translations: Array.isArray(parsed.translations)
      ? parsed.translations.filter(isStr).slice(0, MAX_TRANSLATIONS)
      : [],
    examples: Array.isArray(parsed.examples)
      ? parsed.examples
          .filter(
            (e: unknown): e is { original: string; translated: string } =>
              !!e &&
              isStr((e as { original?: unknown }).original) &&
              isStr((e as { translated?: unknown }).translated),
          )
          .slice(0, MAX_EXAMPLES)
      : [],
    explanation: parseExplanation(parsed.explanation),
    correction: parseCorrection(parsed.correction),
  };
}
