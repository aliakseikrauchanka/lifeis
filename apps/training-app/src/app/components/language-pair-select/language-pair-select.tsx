import { LANGUAGE_OPTIONS } from '../../constants/language-options';

export interface LanguagePairSelectProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  variant: 'compact' | 'full';
}

export function LanguagePairSelect({ value, onChange, disabled, variant }: LanguagePairSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={
        variant === 'compact'
          ? 'sm:hidden px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground'
          : 'hidden sm:block px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground'
      }
    >
      {LANGUAGE_OPTIONS.map((l) => (
        <option key={l.code} value={l.code}>
          {variant === 'compact' ? l.flag : l.label}
        </option>
      ))}
    </select>
  );
}
