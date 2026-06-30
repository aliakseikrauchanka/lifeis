import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeepgramFileSTTProvider, useAudioDevices, useSpeechToText } from '@lifeis/common-ui';
import { Check, ChevronLeft, ChevronRight, Languages, Plus, Volume2, X } from 'lucide-react';
import { Button } from './ui/button';
import { LanguagePairSelect } from './language-pair-select/language-pair-select';
import { SpeechInputButton } from './speech-input-button';
import { WordExplanation } from './word-explanation';
import { PwnDictionaryView } from './pwn-dictionary-view';
import {
  createTranslation,
  updateTranslation,
  translateText,
  explainWord,
  lookupPwnDictionary,
  TranslationProvider,
  ProviderTranslationResult,
  ProviderExplanation,
  ProviderCorrection,
  PwnDictionaryEntry,
} from '../api/srs.api';
import { speak } from '../api/tts.api';
import {
  useTranslationAdd,
  TranslationAddPrefill,
  TranslationAddMode,
  TranslationHistoryEntry,
} from '../contexts/translation-add.context';
import { useAppLanguages } from '../hooks/use-app-languages';
import { useI18n } from '../i18n/i18n-context';

const ORIGINAL_REC_ID = 'global-add-original';
const TRANSLATION_REC_ID = 'global-add-translation';

/** State of an on-demand analysis fetch (explanation/correction), per provider. */
type AsyncCell<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; data: T };

/** Content sub-tabs shown below the provider tabs. 'dictionary' appears only for Polish pairs. */
type ContentTab = 'translations' | 'explanation' | 'dictionary';

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase();
}

/**
 * Standardize a translation/original value the same way the server does on save
 * (see backend `formatEntry`): trim → strip one trailing period (not ? or !) →
 * capitalize the first letter. Idempotent. Applied to model-provided suggestions
 * so chips match what actually gets stored.
 */
function formatEntry(value: string): string {
  let s = value.trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd();
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TRANSLATION_PROVIDERS = ['claude-opus', 'anthropic', 'gemini', 'deepseek', 'glosbe'] as const satisfies readonly TranslationProvider[];

const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  glosbe: 'Glosbe',
  gemini: 'Gemini',
  anthropic: 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
};

type AddFormFields = {
  original: string;
  translation: string;
  originalLanguage: string;
  translationLanguage: string;
};

/** Forward: original → suggestions for translation. Reverse: translation → suggestions for original. */
type TranslatePlan =
  | { ok: false }
  | {
      ok: true;
      sourceText: string;
      targetLang: string;
      sourceLang: string;
      suggestionTarget: 'original' | 'translation';
    };

function getTranslatePlan(form: AddFormFields, _isEdit: boolean): TranslatePlan {
  const orig = form.original.trim();
  const trans = form.translation.trim();
  if (orig.length > 0) {
    return {
      ok: true,
      sourceText: orig,
      targetLang: form.translationLanguage,
      sourceLang: form.originalLanguage,
      suggestionTarget: 'translation',
    };
  }
  if (trans.length > 0) {
    return {
      ok: true,
      sourceText: trans,
      targetLang: form.originalLanguage,
      sourceLang: form.translationLanguage,
      suggestionTarget: 'original',
    };
  }
  return { ok: false };
}

interface ModalBodyProps {
  mode: TranslationAddMode;
  editId: string | null;
  prefill: TranslationAddPrefill | null;
  onClose: () => void;
  onChanged: () => void;
  onSttLanguageChange: (lang: string | undefined) => void;
}

function ModalBody({ mode, editId, prefill, onClose, onChanged, onSttLanguageChange }: ModalBodyProps) {
  const isEdit = mode === 'edit';
  const { t, locale } = useI18n();
  const { stopListening } = useSpeechToText();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();
  const { history, appendHistory, findByOriginalOrTranslation } = useTranslationAdd();
  const [cursor, setCursor] = useState<number | null>(null);
  const [addForm, setAddForm] = useState(() => {
    const savedOrig = !isEdit ? localStorage.getItem('modal-orig-lang') : null;
    const savedTrans = !isEdit ? localStorage.getItem('modal-trans-lang') : null;
    return {
      original: prefill?.original ?? '',
      translation: prefill?.translation ?? '',
      originalLanguage: prefill?.originalLanguage ?? savedOrig ?? trainingLanguage,
      translationLanguage: prefill?.translationLanguage ?? savedTrans ?? nativeLanguage,
    };
  });

  useEffect(() => {
    if (isEdit) return;
    localStorage.setItem('modal-orig-lang', addForm.originalLanguage);
    localStorage.setItem('modal-trans-lang', addForm.translationLanguage);
  }, [isEdit, addForm.originalLanguage, addForm.translationLanguage]);
  const [saving, setSaving] = useState(false);
  const [providerResults, setProviderResults] =
    useState<Partial<Record<TranslationProvider, ProviderTranslationResult>> | null>(null);
  const [loadingProviders, setLoadingProviders] = useState<readonly TranslationProvider[]>([]);
  const translating = loadingProviders.length > 0;
  const [activeProvider, setActiveProvider] = useState<TranslationProvider>('claude-opus');
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('translations');
  /** On-demand PWN dictionary lookup, plus the Polish word it was fetched for. */
  const [pwnEntry, setPwnEntry] = useState<AsyncCell<PwnDictionaryEntry | null> | null>(null);
  const [pwnWord, setPwnWord] = useState<string | null>(null);
  /** On-demand explanation cache, keyed by provider, for the most recent translated source. */
  const [explanations, setExplanations] = useState<
    Partial<Record<TranslationProvider, AsyncCell<ProviderExplanation | null>>>
  >({});
  /** The source text/language of the most recent translate, used by on-demand explain. */
  const [lastSource, setLastSource] = useState<{ text: string; lang: string } | null>(null);
  /** Which input the suggestion chips apply to after the latest translate call */
  const [suggestionTarget, setSuggestionTarget] = useState<'original' | 'translation'>('translation');
  const [recordingField, setRecordingField] = useState<'original' | 'translation' | null>(null);
  const [focusedField, setFocusedField] = useState<'original' | 'translation'>(
    isEdit ? 'translation' : 'original',
  );
  const originalInputRef = useRef<HTMLInputElement | null>(null);
  const translationInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEdit) {
      translationInputRef.current?.focus();
      return;
    }
    const hasOrig = (prefill?.original ?? '').trim();
    const hasTrans = (prefill?.translation ?? '').trim();
    if (hasTrans && !hasOrig) translationInputRef.current?.focus();
    else originalInputRef.current?.focus();
  }, [isEdit, prefill?.original, prefill?.translation]);

  // Fetch translation suggestions + examples on open, for both add and edit.
  useEffect(() => {
    if (getTranslatePlan(addForm, isEdit).ok) {
      handleTranslate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recordingField === 'original') onSttLanguageChange(addForm.originalLanguage);
    else if (recordingField === 'translation') onSttLanguageChange(addForm.translationLanguage);
    else onSttLanguageChange(undefined);
  }, [recordingField, addForm.originalLanguage, addForm.translationLanguage, onSttLanguageChange]);

  const tryAutofillFromLibrary = useCallback(
    (form: AddFormFields, direction: 'forward' | 'reverse' | 'both' = 'both'): AddFormFields => {
      if (isEdit) return form;
      const orig = form.original.trim();
      const trans = form.translation.trim();
      if ((direction === 'forward' || direction === 'both') && orig && !trans) {
        const match = findByOriginalOrTranslation(orig);
        if (
          match &&
          normalize(match.original) === normalize(orig) &&
          match.originalLanguage === form.originalLanguage
        ) {
          return { ...form, translation: match.translation };
        }
      }
      if ((direction === 'reverse' || direction === 'both') && trans && !orig) {
        const match = findByOriginalOrTranslation(trans);
        if (
          match &&
          normalize(match.translation) === normalize(trans) &&
          match.translationLanguage === form.translationLanguage
        ) {
          return { ...form, original: match.original };
        }
      }
      return form;
    },
    [isEdit, findByOriginalOrTranslation],
  );

  useEffect(() => {
    if (isEdit) return;
    setAddForm((prev) => tryAutofillFromLibrary(prev, 'both'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDuplicatePair = useMemo(() => {
    if (isEdit) return false;
    const orig = addForm.original.trim();
    const trans = addForm.translation.trim();
    if (!orig || !trans) return false;
    const match = findByOriginalOrTranslation(orig);
    if (!match) return false;
    return (
      normalize(match.original) === normalize(orig) &&
      normalize(match.translation) === normalize(trans) &&
      match.originalLanguage === addForm.originalLanguage &&
      match.translationLanguage === addForm.translationLanguage
    );
  }, [
    isEdit,
    addForm.original,
    addForm.translation,
    addForm.originalLanguage,
    addForm.translationLanguage,
    findByOriginalOrTranslation,
  ]);

  const handleAppendOriginal = useCallback((text: string) => {
    setAddForm((prev) => ({ ...prev, original: text }));
  }, []);
  const handleAppendTranslation = useCallback((text: string) => {
    setAddForm((prev) => ({ ...prev, translation: text }));
  }, []);

  /** Clears all results and on-demand analysis caches (used when navigating away from a result). */
  const clearAnalysis = useCallback(() => {
    setProviderResults(null);
    setSuggestionTarget('translation');
    setActiveContentTab('translations');
    setExplanations({});
    setLastSource(null);
    setPwnEntry(null);
    setPwnWord(null);
  }, []);

  const handleTranslate = () => {
    const plan = getTranslatePlan(addForm, isEdit);
    if (!plan.ok) return;

    setProviderResults({});
    setSuggestionTarget(plan.suggestionTarget);
    setActiveContentTab('translations');
    setExplanations({});
    setLastSource({ text: plan.sourceText, lang: plan.sourceLang });
    setLoadingProviders(TRANSLATION_PROVIDERS);

    TRANSLATION_PROVIDERS.forEach(async (p) => {
      try {
        const result = await translateText(plan.sourceText, plan.targetLang, plan.sourceLang, p, locale);
        setProviderResults((prev) => ({ ...(prev ?? {}), [p]: result }));
      } catch (err) {
        setProviderResults((prev) => ({
          ...(prev ?? {}),
          [p]: { translations: [], examples: [], correction: null, error: (err as Error)?.message ?? 'failed' },
        }));
      } finally {
        setLoadingProviders((prev) => prev.filter((x) => x !== p));
      }
    });
  };

  const handleSave = async () => {
    if (!addForm.original.trim() || !addForm.translation.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateTranslation(editId, {
          original: addForm.original.trim(),
          translation: addForm.translation.trim(),
        });
        onChanged();
        onClose();
      } else {
        const entry: TranslationHistoryEntry = {
          original: addForm.original.trim(),
          translation: addForm.translation.trim(),
          originalLanguage: addForm.originalLanguage,
          translationLanguage: addForm.translationLanguage,
        };
        await createTranslation(addForm);
        appendHistory(entry);
        setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
        clearAnalysis();
        setCursor(null);
        onChanged();
        originalInputRef.current?.focus();
      }
    } catch (err) {
      console.error('Failed to save translation:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrev = useCallback(() => {
    if (history.length === 0) return;
    const next = cursor === null ? history.length - 1 : cursor - 1;
    if (next < 0) return;
    const entry = history[next];
    setCursor(next);
    setAddForm({
      original: entry.original,
      translation: entry.translation,
      originalLanguage: entry.originalLanguage,
      translationLanguage: entry.translationLanguage,
    });
    clearAnalysis();
  }, [cursor, history, clearAnalysis]);

  const handleNext = useCallback(() => {
    if (cursor === null) return;
    const next = cursor + 1;
    if (next >= history.length) {
      setCursor(null);
      setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
      clearAnalysis();
      return;
    }
    const entry = history[next];
    setCursor(next);
    setAddForm({
      original: entry.original,
      translation: entry.translation,
      originalLanguage: entry.originalLanguage,
      translationLanguage: entry.translationLanguage,
    });
    clearAnalysis();
  }, [cursor, history, clearAnalysis]);

  const handleNewEntry = useCallback(() => {
    setCursor(null);
    setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
    clearAnalysis();
    originalInputRef.current?.focus();
  }, [clearAnalysis]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const translatePlan = getTranslatePlan(addForm, isEdit);
  const suggestionSpeakLang =
    suggestionTarget === 'translation' ? addForm.translationLanguage : addForm.originalLanguage;
  const suggestionSelected =
    suggestionTarget === 'translation' ? addForm.translation : addForm.original;

  const applySuggestion = (opt: string) => {
    setAddForm((prev) =>
      suggestionTarget === 'translation'
        ? { ...prev, translation: opt }
        : { ...prev, original: opt },
    );
  };

  const activeResult = providerResults?.[activeProvider];
  const correctionSourceField: 'original' | 'translation' =
    suggestionTarget === 'translation' ? 'original' : 'translation';
  const applyCorrection = (corrected: string) => {
    setAddForm((prev) => ({ ...prev, [correctionSourceField]: corrected }));
  };

  // The Polish word in the pair (if any) — drives the provider-independent PWN dictionary tab.
  const polishWord =
    addForm.originalLanguage === 'pl'
      ? addForm.original.trim()
      : addForm.translationLanguage === 'pl'
        ? addForm.translation.trim()
        : '';
  const hasPolish = polishWord.length > 0;

  // If the pair stops having a Polish side, leave the dictionary tab.
  useEffect(() => {
    if (!hasPolish && activeContentTab === 'dictionary') setActiveContentTab('translations');
  }, [hasPolish, activeContentTab]);

  // Fetch the PWN dictionary entry on demand when the user opens the Dictionary tab (cached per word).
  useEffect(() => {
    if (activeContentTab !== 'dictionary' || !polishWord) return;
    if (pwnWord === polishWord && pwnEntry) return; // already loading/loaded for this word
    setPwnWord(polishWord);
    setPwnEntry({ status: 'loading' });
    lookupPwnDictionary(polishWord)
      .then((data) => setPwnEntry({ status: 'done', data }))
      .catch((e) => setPwnEntry({ status: 'error', error: (e as Error)?.message ?? 'failed' }));
  }, [activeContentTab, polishWord, pwnWord, pwnEntry]);

  // Fetch the explanation (incl. synonyms) when the user opens the Explanation tab — or eagerly while editing,
  // so the synonyms are ready alongside the examples (cached per provider).
  useEffect(() => {
    if (!lastSource || activeProvider === 'glosbe') return;
    if ((activeContentTab === 'explanation' || isEdit) && !explanations[activeProvider]) {
      setExplanations((p) => ({ ...p, [activeProvider]: { status: 'loading' } }));
      explainWord(lastSource.text, lastSource.lang, activeProvider, locale)
        .then((data) =>
          setExplanations((p) => ({ ...p, [activeProvider]: { status: 'done', data } })),
        )
        .catch((e) =>
          setExplanations((p) => ({
            ...p,
            [activeProvider]: { status: 'error', error: (e as Error)?.message ?? 'failed' },
          })),
        );
    }
  }, [activeContentTab, activeProvider, lastSource, locale, explanations, isEdit]);

  const renderExplanation = (explanation: ProviderExplanation | null) => {
    if (!explanation) {
      return <p className="text-sm text-muted-foreground">{t('modal.explanationUnavailable')}</p>;
    }
    return <WordExplanation explanation={explanation} speakLang={lastSource?.lang ?? ''} />;
  };

  const renderCorrection = (correction: ProviderCorrection) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionHeading')}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyCorrection(correction.corrected)}
          className="self-start inline-flex items-center gap-2"
          title={t('modal.applyCorrection')}
        >
          <Check className="h-3.5 w-3.5" />
          <span>{correction.corrected}</span>
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionWhat')}
        </span>
        <span className="text-sm">{correction.what}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {t('modal.correctionWhy')}
        </span>
        <span className="text-sm text-muted-foreground">{correction.why}</span>
      </div>
    </div>
  );

  const analysisSpinner = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      {t('modal.analyzing')}
    </div>
  );

  const renderExplanationPanel = () => {
    if (activeProvider === 'glosbe') {
      return <p className="text-sm text-muted-foreground">{t('modal.explanationUnavailable')}</p>;
    }
    const cell = explanations[activeProvider];
    if (!cell || cell.status === 'loading') return analysisSpinner;
    if (cell.status === 'error') {
      return <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: cell.error })}</p>;
    }
    return renderExplanation(cell.data);
  };

  const renderDictionaryPanel = () => {
    if (!pwnEntry || pwnEntry.status === 'loading') return analysisSpinner;
    if (pwnEntry.status === 'error') {
      return <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: pwnEntry.error })}</p>;
    }
    if (!pwnEntry.data) {
      return <p className="text-sm text-muted-foreground">{t('modal.pwnNotFound')}</p>;
    }
    return <PwnDictionaryView entry={pwnEntry.data} speakLang="pl" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full h-full bg-background rounded-lg shadow-lg border overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-translation-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 gap-2">
          <h3 id="add-translation-title" className="text-base font-semibold shrink-0">
            {isEdit ? t('modal.editTranslation') : t('header.addTranslation')}
          </h3>
          {!isEdit && history.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handlePrev}
                disabled={cursor === 0}
                title={t('modal.historyPrev')}
                aria-label={t('modal.historyPrev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {cursor !== null && (
                <span className="text-xs text-muted-foreground tabular-nums px-1" aria-live="polite">
                  {cursor + 1} / {history.length}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleNext}
                disabled={cursor === null}
                title={t('modal.historyNext')}
                aria-label={t('modal.historyNext')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {cursor !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 ml-1"
                  onClick={handleNewEntry}
                  title={t('modal.historyNew')}
                >
                  <Plus className="h-4 w-4" />
                  <span className="ml-1 text-xs">{t('modal.historyNew')}</span>
                </Button>
              )}
            </div>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose} title={t('profile.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col gap-2 p-4 pb-2 shrink-0">
            <div className="flex gap-2 items-stretch">
              <div className="flex shrink-0">
                <Button
                  onClick={handleTranslate}
                  disabled={translating || !translatePlan.ok}
                  title={t('modal.suggestTitle')}
                  aria-label={t('modal.suggestTitle')}
                  className="group h-full w-12 flex-col gap-1 rounded-xl border border-amber-400/40 bg-gradient-to-b from-amber-400 to-amber-600 px-0 text-white shadow-sm transition-all hover:from-amber-400 hover:to-amber-700 hover:shadow-md hover:shadow-amber-500/20 active:scale-[0.97] focus-visible:ring-amber-500"
                >
                  {translating ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Languages className="h-5 w-5 transition-transform group-hover:scale-110" />
                  )}
                </Button>
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex flex-row gap-2 items-start">
                  <div className="relative flex-1 min-w-0">
                    <input
                      ref={originalInputRef}
                      type="text"
                      placeholder={t('modal.placeholderOriginal')}
                      value={addForm.original}
                      onChange={(e) =>
                        setAddForm((prev) =>
                          tryAutofillFromLibrary({ ...prev, original: e.target.value }, 'forward'),
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !translating && !isEdit && translatePlan.ok) {
                          e.preventDefault();
                          handleTranslate();
                        }
                      }}
                      onFocus={() => setFocusedField('original')}
                      autoFocus={!isEdit}
                      // disabled={isEdit}
                      className={`w-full pl-3 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground ${
                        addForm.original ? 'pr-16' : 'pr-3'
                      }`}
                    />
                    {addForm.original && !isEdit && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setAddForm((prev) => ({ ...prev, original: '' }));
                            stopListening(ORIGINAL_REC_ID);
                          }}
                          title={t('modal.clear')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => speak(addForm.original, addForm.originalLanguage)}
                          title={t('a11y.speak')}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {addForm.original && isEdit && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => speak(addForm.original, addForm.originalLanguage)}
                          title={t('a11y.speak')}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-nowrap shrink-0">
                    <SpeechInputButton
                      id={ORIGINAL_REC_ID}
                      onAppend={handleAppendOriginal}
                      disabled={isEdit || recordingField === 'translation'}
                      onStart={() => setRecordingField('original')}
                      onStop={() => setRecordingField(null)}
                      active={recordingField !== 'translation'}
                      shortcutEnabled={focusedField === 'original'}
                    />
                    <LanguagePairSelect
                      variant="compact"
                      value={addForm.originalLanguage}
                      onChange={(code) => setAddForm((prev) => ({ ...prev, originalLanguage: code }))}
                      disabled={isEdit}
                    />
                    <LanguagePairSelect
                      variant="full"
                      value={addForm.originalLanguage}
                      onChange={(code) => setAddForm((prev) => ({ ...prev, originalLanguage: code }))}
                      disabled={isEdit}
                    />
                  </div>
                </div>
                <div className="flex flex-row gap-2 items-start">
                  <div className="relative flex-1 min-w-0">
                    <input
                      ref={translationInputRef}
                      type="text"
                      placeholder={t('modal.placeholderTranslation')}
                      value={addForm.translation}
                      onChange={(e) =>
                        setAddForm((prev) =>
                          tryAutofillFromLibrary({ ...prev, translation: e.target.value }, 'reverse'),
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        if (translatePlan.ok && translatePlan.suggestionTarget === 'original' && !translating) {
                          e.preventDefault();
                          handleTranslate();
                          return;
                        }
                        handleSave();
                      }}
                      onFocus={() => setFocusedField('translation')}
                      autoFocus={isEdit}
                      className={`w-full pl-3 py-2 text-sm rounded-md border border-input bg-background ${
                        addForm.translation ? 'pr-16' : 'pr-3'
                      }`}
                    />
                    {addForm.translation && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setAddForm((prev) => ({ ...prev, translation: '' }));
                            stopListening(TRANSLATION_REC_ID);
                          }}
                          title={t('modal.clear')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => speak(addForm.translation, addForm.translationLanguage)}
                          title={t('a11y.speak')}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-nowrap shrink-0">
                    <SpeechInputButton
                      id={TRANSLATION_REC_ID}
                      onAppend={handleAppendTranslation}
                      disabled={recordingField === 'original'}
                      onStart={() => setRecordingField('translation')}
                      onStop={() => setRecordingField(null)}
                      active={recordingField !== 'original'}
                      shortcutEnabled={focusedField === 'translation'}
                    />
                    <LanguagePairSelect
                      variant="compact"
                      value={addForm.translationLanguage}
                      onChange={(code) => setAddForm((prev) => ({ ...prev, translationLanguage: code }))}
                      disabled={isEdit}
                    />
                    <LanguagePairSelect
                      variant="full"
                      value={addForm.translationLanguage}
                      onChange={(code) => setAddForm((prev) => ({ ...prev, translationLanguage: code }))}
                      disabled={isEdit}
                    />
                  </div>
                </div>
              </div>
            </div>
            {translating && !providerResults && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                {t('modal.fetchingSuggestions')}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-2">
            {providerResults && (
              <div className="rounded-md border">
                <div className="flex flex-nowrap justify-between gap-1 px-1 border-b sticky top-0 bg-background rounded-t-md z-10 overflow-x-auto no-scrollbar">
                  {TRANSLATION_PROVIDERS.map((p) => {
                    const r = providerResults[p];
                    const label = PROVIDER_LABELS[p];
                    const count = r?.translations?.length ?? 0;
                    const isActive = activeProvider === p;
                    const isLoading = loadingProviders.includes(p);
                    const hasResults = !isLoading && !r?.error && count > 0;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActiveProvider(p)}
                        className={
                          'shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center justify-center gap-1 whitespace-nowrap ' +
                          (isActive
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-muted-foreground hover:text-foreground')
                        }
                      >
                        {hasResults && <Check className="h-3.5 w-3.5" />}
                        <span>{label}</span>
                        {isLoading ? (
                          <span className="inline-block animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full align-middle" />
                        ) : r?.error ? (
                          <span className="text-xs text-red-600">!</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex border-b">
                  {(hasPolish
                    ? (['translations', 'explanation', 'dictionary'] as ContentTab[])
                    : (['translations', 'explanation'] as ContentTab[])
                  ).map((tab) => {
                    const label =
                      tab === 'translations'
                        ? t('modal.tabTranslations')
                        : tab === 'explanation'
                          ? t('modal.tabExplanation')
                          : t('modal.tabDictionary');
                    const isActive = activeContentTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveContentTab(tab)}
                        className={
                          'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ' +
                          (isActive
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-muted-foreground hover:text-foreground')
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 flex flex-col gap-3">
                  {(() => {
                    if (activeContentTab === 'explanation') return renderExplanationPanel();
                    if (activeContentTab === 'dictionary') return renderDictionaryPanel();

                    // translations tab
                    const r = activeResult;
                    if (!r) {
                      if (loadingProviders.includes(activeProvider)) {
                        return (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            {t('modal.fetchingSuggestions')}
                          </div>
                        );
                      }
                      return null;
                    }
                    if (r.error) {
                      return (
                        <p className="text-sm text-red-600">{t('modal.errorWithReason', { message: r.error })}</p>
                      );
                    }
                    if (r.translations.length === 0 && !r.correction) {
                      return <p className="text-sm text-muted-foreground">{t('modal.noSuggestions')}</p>;
                    }
                    return (
                      <>
                        {r.correction && (
                          <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
                            {renderCorrection(r.correction)}
                          </div>
                        )}
                        {r.translations.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {t('modal.translationsHeading')}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {r.translations.map((rawOpt, i) => {
                              const opt = formatEntry(rawOpt);
                              return (
                              <Button
                                key={`${activeProvider}-t-${i}`}
                                variant={suggestionSelected === opt ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applySuggestion(opt)}
                                className={`inline-flex items-center gap-2 ${
                                  suggestionSelected === opt
                                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : ''
                                }`}
                              >
                                <span>{opt}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(opt, suggestionSpeakLang);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      speak(opt, suggestionSpeakLang);
                                    }
                                  }}
                                  title={t('a11y.speak')}
                                  className="inline-flex items-center opacity-70 hover:opacity-100"
                                >
                                  <Volume2 className="h-3 w-3" />
                                </span>
                              </Button>
                              );
                            })}
                          </div>
                        </div>
                        )}
                        {r.examples && r.examples.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {t('modal.examplesHeading')}
                            </span>
                            <ul className="flex flex-col gap-1.5">
                              {r.examples.map((ex, i) => (
                                <li key={`${activeProvider}-e-${i}`} className="text-sm">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium flex-1">{ex.original}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 shrink-0"
                                      onClick={() => speak(ex.original, addForm.originalLanguage)}
                                      title={t('a11y.speak')}
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground flex-1">{ex.translated}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 shrink-0"
                                      onClick={() => speak(ex.translated, addForm.translationLanguage)}
                                      title={t('a11y.speak')}
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('modal.cancel')}
          </Button>
          <span
            title={isDuplicatePair ? 'Pair already exists in library' : undefined}
            className="inline-block"
          >
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                saving ||
                !addForm.original.trim() ||
                !addForm.translation.trim() ||
                isDuplicatePair
              }
            >
              {saving
                ? isEdit
                  ? t('modal.saving')
                  : t('modal.adding')
                : isEdit
                  ? t('modal.save')
                  : t('modal.add')}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

export function TranslationAddModal() {
  const { isOpen, mode, editId, prefill, close, notifyChanged } = useTranslationAdd();
  const [sttLanguage, setSttLanguage] = useState<string | undefined>(undefined);
  const { inputDeviceId, outputDeviceId } = useAudioDevices();

  if (!isOpen) return null;

  return (
    <DeepgramFileSTTProvider
      language={sttLanguage}
      audioInputDeviceId={inputDeviceId || undefined}
      audioOutputDeviceId={outputDeviceId || undefined}
    >
      <ModalBody
        mode={mode}
        editId={editId}
        prefill={prefill}
        onClose={close}
        onChanged={notifyChanged}
        onSttLanguageChange={setSttLanguage}
      />
    </DeepgramFileSTTProvider>
  );
}
