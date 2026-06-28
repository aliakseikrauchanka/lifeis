import { ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { PwnDictionaryEntry } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { useI18n } from '../i18n/i18n-context';

interface PwnDictionaryViewProps {
  entry: PwnDictionaryEntry;
  /** Language code used for the speak buttons (the Polish word's language). */
  speakLang: string;
}

/** Renders a sjp.pwn.pl dictionary entry. Shared by the Add/Edit modal and the Study card. */
export function PwnDictionaryView({ entry, speakLang }: PwnDictionaryViewProps) {
  const { t } = useI18n();
  const speakWord = (text: string) => speak(text, speakLang);
  const section = (label: string, body: ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
      {body}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 text-left">
      {entry.headword && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.baseForm')}</span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{entry.headword}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => speakWord(entry.headword as string)}
              title={t('a11y.speak')}
            >
              <Volume2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {entry.inflection && section(t('modal.pwnInflection'), <span className="text-sm">{entry.inflection}</span>)}
      {entry.definitions.length > 0 &&
        section(
          t('modal.pwnDefinitions'),
          <ol className="list-decimal list-inside flex flex-col gap-0.5">
            {entry.definitions.map((d, i) => (
              <li key={`pwn-def-${i}`} className="text-sm">
                {d}
              </li>
            ))}
          </ol>,
        )}
      {entry.synonyms.length > 0 &&
        section(
          t('modal.synonyms'),
          <div className="flex flex-wrap gap-1">
            {entry.synonyms.map((syn, i) => (
              <span
                key={`pwn-syn-${i}`}
                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-sm"
              >
                <span>{syn}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={() => speakWord(syn)}
                  title={t('a11y.speak')}
                >
                  <Volume2 className="h-3 w-3" />
                </Button>
              </span>
            ))}
          </div>,
        )}
      {entry.etymology &&
        section(t('modal.pwnEtymology'), <span className="text-sm text-muted-foreground">{entry.etymology}</span>)}
      {entry.examples.length > 0 &&
        section(
          t('modal.pwnExamples'),
          <ul className="flex flex-col gap-1">
            {entry.examples.map((ex, i) => (
              <li key={`pwn-ex-${i}`} className="text-sm text-muted-foreground">
                {ex}
              </li>
            ))}
          </ul>,
        )}
      <a
        href={entry.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline underline-offset-2 self-start"
      >
        {t('modal.pwnSource')}
      </a>
    </div>
  );
}
