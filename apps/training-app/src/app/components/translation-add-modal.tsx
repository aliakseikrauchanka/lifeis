import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeepgramFileSTTProvider, useAudioDevices, useSpeechToText } from '@lifeis/common-ui';
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Languages, Plus, Volume2, X } from 'lucide-react';
import { Button } from './ui/button';
import { LanguagePairSelect } from './language-pair-select/language-pair-select';
import { SpeechInputButton } from './speech-input-button';
import {
  createTranslation,
  updateTranslation,
  translateText,
  TranslationProvider,
  ProviderTranslationResult,
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

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase();
}

const TRANSLATION_PROVIDERS = ['openai', 'deepseek', 'glosbe', 'gemini'] as const satisfies readonly TranslationProvider[];

const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  glosbe: 'Glosbe',
  gemini: 'Gemini',
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
  const { t } = useI18n();
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
  const [activeProvider, setActiveProvider] = useState<TranslationProvider>('openai');
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

  useEffect(() => {
    if (isEdit) return;
    if (getTranslatePlan(addForm, false).ok) {
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

  const handleTranslate = () => {
    const plan = getTranslatePlan(addForm, isEdit);
    if (!plan.ok) return;

    setProviderResults({});
    setSuggestionTarget(plan.suggestionTarget);
    setLoadingProviders(TRANSLATION_PROVIDERS);

    TRANSLATION_PROVIDERS.forEach(async (p) => {
      try {
        const result = await translateText(plan.sourceText, plan.targetLang, plan.sourceLang, p);
        setProviderResults((prev) => ({ ...(prev ?? {}), [p]: result }));
      } catch (err) {
        setProviderResults((prev) => ({
          ...(prev ?? {}),
          [p]: { translations: [], examples: [], error: (err as Error)?.message ?? 'failed' },
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
        setProviderResults(null);
        setSuggestionTarget('translation');
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
    setProviderResults(null);
    setSuggestionTarget('translation');
  }, [cursor, history]);

  const handleNext = useCallback(() => {
    if (cursor === null) return;
    const next = cursor + 1;
    if (next >= history.length) {
      setCursor(null);
      setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
      setProviderResults(null);
      setSuggestionTarget('translation');
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
    setProviderResults(null);
    setSuggestionTarget('translation');
  }, [cursor, history]);

  const handleNewEntry = useCallback(() => {
    setCursor(null);
    setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
    setProviderResults(null);
    setSuggestionTarget('translation');
    originalInputRef.current?.focus();
  }, []);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl h-[85vh] max-h-[700px] bg-background rounded-lg shadow-lg border overflow-hidden"
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
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
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
                  <div className="flex gap-1 flex-wrap sm:flex-nowrap">
                    <Button
                      size="sm"
                      className="shrink-0 px-2 bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={handleTranslate}
                      disabled={translating || !translatePlan.ok}
                      title={t('modal.suggestTitle')}
                    >
                      <Languages className="h-4 w-4" />
                    </Button>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
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
                  <div className="flex gap-1 flex-wrap sm:flex-nowrap">
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
              <div className="flex items-center shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2"
                  onClick={() => {
                    setProviderResults(null);
                    setSuggestionTarget('translation');
                    setAddForm((prev) => ({
                      ...prev,
                      originalLanguage: prev.translationLanguage,
                      translationLanguage: prev.originalLanguage,
                    }));
                  }}
                  disabled={isEdit}
                  title={t('modal.swapLanguagesTitle')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
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
            {!providerResults && !translating && translatePlan.ok && (
              <div className="flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTranslate}
                  className="gap-2"
                >
                  <Languages className="h-4 w-4" />
                  {t('modal.getExamples')}
                </Button>
              </div>
            )}
            {providerResults && (
              <div className="rounded-md border">
                <div className="flex flex-wrap border-b sticky top-0 bg-background rounded-t-md z-10">
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
                          'flex-1 basis-[140px] px-3 py-2 text-sm font-medium border-b-2 transition-colors inline-flex items-center justify-center gap-1 ' +
                          (isActive
                            ? 'border-primary text-primary'
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
                <div className="p-3 flex flex-col gap-3">
                  {(() => {
                    const r = providerResults[activeProvider];
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
                    if (r.translations.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">{t('modal.noSuggestions')}</p>
                      );
                    }
                    return (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {t('modal.translationsHeading')}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {r.translations.map((opt, i) => (
                              <Button
                                key={`${activeProvider}-t-${i}`}
                                variant={suggestionSelected === opt ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => applySuggestion(opt)}
                                className="inline-flex items-center gap-2"
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
                            ))}
                          </div>
                        </div>
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
