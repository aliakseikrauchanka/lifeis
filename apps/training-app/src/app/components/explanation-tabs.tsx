import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { WordExplanation } from './word-explanation';
import { PwnDictionaryView } from './pwn-dictionary-view';
import { explainWord, lookupPwnDictionary, ProviderExplanation, PwnDictionaryEntry } from '../api/srs.api';
import { useI18n } from '../i18n/i18n-context';
import { usePwnEnabled } from '../hooks/use-pwn-enabled';
import { useExplanationProvider } from '../hooks/use-explanation-provider';

type PwnAsyncCell =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; data: PwnDictionaryEntry | null };

interface ExplanationTabsProps {
  /** The foreign word to look up / explain. */
  word: string;
  /** Language code of the word (e.g. 'pl'). */
  language: string;
  /**
   * Whether the panel is currently visible to the user. The LLM explanation is only
   * requested while active, so it isn't fetched for cards that are never revealed.
   * Defaults to true.
   */
  active?: boolean;
  /**
   * Force the explanation-only view: never show the PWN dictionary tab, and keep the
   * LLM explanation strictly on-demand (button). Used where there is no single dictionary
   * word, e.g. a full sentence in Sentence Builder.
   */
  explanationOnly?: boolean;
}

/**
 * Word reference panel shared by Study and Word Builder.
 *
 * When the PWN dictionary is enabled (settings) for a Polish word, a PWN / Explanation tab pair
 * is shown: the PWN entry is prefetched and the explanation is requested automatically when its
 * tab is opened. Otherwise only the explanation is shown, requested on demand via a button.
 */
export function ExplanationTabs({ word, language, active = true, explanationOnly = false }: ExplanationTabsProps) {
  const { t, locale } = useI18n();
  const [pwnEnabled] = usePwnEnabled();
  const [explanationProvider] = useExplanationProvider();
  const showTabs = !explanationOnly && pwnEnabled && language === 'pl';

  const [activeTab, setActiveTab] = useState<'pwn' | 'llm'>('pwn');
  const [pwnEntry, setPwnEntry] = useState<PwnAsyncCell | null>(null);
  const [explanation, setExplanation] = useState<ProviderExplanation | null>(null);
  const [explained, setExplained] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  // Reset state and (in tabs mode) prefetch the authoritative PWN dictionary entry on word change.
  useEffect(() => {
    setExplanation(null);
    setExplained(false);
    setExplanationError(null);
    setLoadingExplanation(false);
    setActiveTab('pwn');

    if (!word || !showTabs) {
      setPwnEntry(null);
      return;
    }
    let cancelled = false;
    setPwnEntry({ status: 'loading' });
    lookupPwnDictionary(word)
      .then((entry) => {
        if (!cancelled) setPwnEntry({ status: 'done', data: entry });
      })
      .catch((e) => {
        if (!cancelled) setPwnEntry({ status: 'error', error: (e as Error)?.message ?? 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [word, language, showTabs]);

  const handleExplain = useCallback(async () => {
    if (!word) return;
    setLoadingExplanation(true);
    setExplanationError(null);
    try {
      const e = await explainWord(word, language, explanationProvider, locale);
      setExplanation(e);
      setExplained(true);
    } catch (err) {
      setExplanationError((err as Error)?.message ?? 'failed');
    } finally {
      setLoadingExplanation(false);
    }
  }, [word, language, locale, explanationProvider]);

  // In tabs mode, request the explanation automatically as soon as its tab is opened.
  // In single-view mode it stays on-demand (button below).
  useEffect(() => {
    if (!active || !showTabs || activeTab !== 'llm') return;
    if (explained || loadingExplanation || explanationError) return;
    handleExplain();
  }, [active, showTabs, activeTab, explained, loadingExplanation, explanationError, handleExplain]);

  const spinner = (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      {t('modal.analyzing')}
    </div>
  );

  const renderExplanation = () => {
    if (explanationError) {
      return <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: explanationError })}</p>;
    }
    if (loadingExplanation) return spinner;
    if (explained) {
      return explanation ? (
        <WordExplanation explanation={explanation} speakLang={language} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('modal.explanationUnavailable')}</p>
      );
    }
    // Not requested yet: button in single-view mode, spinner while the tabs-mode auto-fetch kicks in.
    if (!showTabs) {
      return (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExplain}>
            <Sparkles className="h-4 w-4" />
            {t('study.explain')}
          </Button>
        </div>
      );
    }
    return spinner;
  };

  const renderPwn = () => {
    if (!pwnEntry || pwnEntry.status === 'loading') return spinner;
    if (pwnEntry.status === 'error') {
      return <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: pwnEntry.error })}</p>;
    }
    if (!pwnEntry.data) {
      return <p className="text-sm text-muted-foreground">{t('modal.pwnNotFound')}</p>;
    }
    return <PwnDictionaryView entry={pwnEntry.data} speakLang="pl" />;
  };

  return (
    <div>
      {showTabs && (
        <div className="sticky top-0 z-10 flex border-b justify-center mb-3 bg-background -mt-3 pt-3">
          {(['pwn', 'llm'] as const).map((tab) => {
            const label = tab === 'pwn' ? t('modal.tabDictionary') : t('modal.tabExplanation');
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={
                  'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ' +
                  (isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {showTabs && activeTab === 'pwn' ? renderPwn() : renderExplanation()}
    </div>
  );
}
