import { Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { ProviderExplanation } from '../api/srs.api';
import { speak } from '../api/tts.api';
import { useI18n } from '../i18n/i18n-context';

interface WordExplanationProps {
  explanation: ProviderExplanation;
  /** Language code used for the speak buttons (the explained word's language). */
  speakLang: string;
}

/** Renders an LLM word explanation. Shared by the Add/Edit modal and the Study card. */
export function WordExplanation({ explanation, speakLang }: WordExplanationProps) {
  const { t } = useI18n();
  const speakWord = (text: string) => speak(text, speakLang);

  return (
    <div className="flex flex-col gap-3 text-left">
      {explanation.baseForm && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.baseForm')}</span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{explanation.baseForm}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => speakWord(explanation.baseForm as string)}
              title={t('a11y.speak')}
            >
              <Volume2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {explanation.meaning && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.meaning')}</span>
          <span className="text-sm">{explanation.meaning}</span>
        </div>
      )}
      {explanation.synonyms && explanation.synonyms.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.synonyms')}</span>
          <div className="flex flex-wrap gap-1">
            {explanation.synonyms.map((syn, i) => (
              <span
                key={`syn-${i}`}
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
          </div>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.partOfSpeech')}</span>
        <span className="text-sm">{explanation.partOfSpeech}</span>
      </div>
      {explanation.inflection && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {explanation.inflection.title || t('modal.inflectionHeading')}
          </span>
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  {explanation.inflection.columns.map((c, i) => (
                    <th key={`col-${i}`} className="text-left font-medium text-muted-foreground px-2 py-1 border-b">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {explanation.inflection.rows.map((row, ri) => (
                  <tr key={`row-${ri}`}>
                    <td className="font-medium text-muted-foreground px-2 py-1 border-b">{row.label}</td>
                    {row.cells.map((cell, ci) => (
                      <td key={`cell-${ri}-${ci}`} className="px-2 py-1 border-b">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {explanation.note && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase">{t('modal.usageNote')}</span>
          <span className="text-sm text-muted-foreground">{explanation.note}</span>
        </div>
      )}
    </div>
  );
}
