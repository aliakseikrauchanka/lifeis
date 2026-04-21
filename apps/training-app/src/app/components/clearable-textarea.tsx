import { Volume2, X } from 'lucide-react';

interface ClearableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  canClear?: boolean;
  onSpeak?: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ClearableTextarea({
  value,
  onChange,
  onClear,
  canClear = true,
  onSpeak,
  disabled,
  placeholder,
  className = 'min-h-[8rem]',
}: ClearableTextareaProps) {
  const showClear = !!value && canClear && !disabled;
  const showSpeak = !!value && !!onSpeak;
  return (
    <div className="relative">
      <textarea
        className={`w-full rounded border border-input bg-background p-2 pr-8 text-sm ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
        {showClear && (
          <button
            type="button"
            onClick={() => {
              onClear?.();
              onChange('');
            }}
            title="Clear input"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showSpeak && (
          <button
            type="button"
            onClick={() => onSpeak?.(value)}
            title="Speak text"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
