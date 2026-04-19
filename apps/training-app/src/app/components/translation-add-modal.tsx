import { useCallback, useEffect, useState } from 'react';
import { DeepgramFileSTTProvider, useAudioDevices, useSpeechToText } from '@lifeis/common-ui';
import { ArrowUpDown, Languages, Volume2, X } from 'lucide-react';
import { Button } from './ui/button';
import { SpeechInputButton } from './speech-input-button';
import {
  createTranslation,
  updateTranslation,
  translateTextMulti,
  TranslationProvider,
  ProviderTranslationResult,
} from '../api/srs.api';
import { speak } from '../api/tts.api';
import {
  useTranslationAdd,
  TranslationAddPrefill,
  TranslationAddMode,
} from '../contexts/translation-add.context';
import { LANGUAGE_OPTIONS } from '../constants/language-options';
import { useAppLanguages } from '../hooks/use-app-languages';
import { useI18n } from '../i18n/i18n-context';

const ORIGINAL_REC_ID = 'global-add-original';
const TRANSLATION_REC_ID = 'global-add-translation';

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
  const [translating, setTranslating] = useState(false);
  const [providerResults, setProviderResults] =
    useState<Record<TranslationProvider, ProviderTranslationResult> | null>(null);
  const [activeProvider, setActiveProvider] = useState<TranslationProvider>('openai');
  const [recordingField, setRecordingField] = useState<'original' | 'translation' | null>(null);

  useEffect(() => {
    if (recordingField === 'original') onSttLanguageChange(addForm.originalLanguage);
    else if (recordingField === 'translation') onSttLanguageChange(addForm.translationLanguage);
    else onSttLanguageChange(undefined);
  }, [recordingField, addForm.originalLanguage, addForm.translationLanguage, onSttLanguageChange]);

  const handleAppendOriginal = useCallback((text: string) => {
    setAddForm((prev) => ({ ...prev, original: text }));
  }, []);
  const handleAppendTranslation = useCallback((text: string) => {
    setAddForm((prev) => ({ ...prev, translation: text }));
  }, []);

  const handleTranslate = async () => {
    if (!addForm.original.trim()) return;
    setTranslating(true);
    setProviderResults(null);
    try {
      const providers = await translateTextMulti(
        addForm.original,
        addForm.translationLanguage,
        addForm.originalLanguage,
      );
      setProviderResults(providers);
      const firstWithTranslations = (['openai', 'deepseek', 'glosbe'] as TranslationProvider[]).find(
        (p) => providers[p]?.translations?.length > 0,
      );
      if (firstWithTranslations) setActiveProvider(firstWithTranslations);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslating(false);
    }
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
      } else {
        await createTranslation(addForm);
      }
      onChanged();
      onClose();
    } catch (err) {
      console.error('Failed to save translation:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 id="add-translation-title" className="text-base font-semibold">
            {isEdit ? t('modal.editTranslation') : t('header.addTranslation')}
          </h3>
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
                      type="text"
                      placeholder={t('modal.placeholderOriginal')}
                      value={addForm.original}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, original: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && addForm.original.trim() && !translating && !isEdit) {
                          e.preventDefault();
                          handleTranslate();
                        }
                      }}
                      autoFocus={!isEdit}
                      disabled={isEdit}
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
                      disabled={isEdit || translating || !addForm.original.trim()}
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
                    />
                    <select
                      value={addForm.originalLanguage}
                      onChange={(e) => {
                        setAddForm((prev) => ({ ...prev, originalLanguage: e.target.value }));
                      }}
                      disabled={isEdit}
                      className="sm:hidden px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag}
                        </option>
                      ))}
                    </select>
                    <select
                      value={addForm.originalLanguage}
                      onChange={(e) => {
                        setAddForm((prev) => ({ ...prev, originalLanguage: e.target.value }));
                      }}
                      disabled={isEdit}
                      className="hidden sm:block px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={t('modal.placeholderTranslation')}
                      value={addForm.translation}
                      onChange={(e) =>
                        setAddForm((prev) => ({ ...prev, translation: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                      }}
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
                    />
                    <select
                      value={addForm.translationLanguage}
                      onChange={(e) => {
                        setAddForm((prev) => ({ ...prev, translationLanguage: e.target.value }));
                      }}
                      disabled={isEdit}
                      className="sm:hidden px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag}
                        </option>
                      ))}
                    </select>
                    <select
                      value={addForm.translationLanguage}
                      onChange={(e) => {
                        setAddForm((prev) => ({ ...prev, translationLanguage: e.target.value }));
                      }}
                      disabled={isEdit}
                      className="hidden sm:block px-2 py-2 text-sm rounded-md border border-input bg-background disabled:bg-muted/40 disabled:text-muted-foreground"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
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
            {translating && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                {t('modal.fetchingSuggestions')}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pt-2">
            {providerResults && (
              <div className="rounded-md border">
                <div className="flex border-b sticky top-0 bg-background rounded-t-md z-10">
                  {(['openai', 'deepseek', 'glosbe'] as TranslationProvider[]).map((p) => {
                    const r = providerResults[p];
                    const label = p === 'openai' ? 'OpenAI' : p === 'deepseek' ? 'DeepSeek' : 'Glosbe';
                    const count = r?.translations?.length ?? 0;
                    const isActive = activeProvider === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActiveProvider(p)}
                        className={
                          'flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ' +
                          (isActive
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground')
                        }
                      >
                        {label}
                        {r?.error ? (
                          <span className="ml-1 text-xs text-red-600">!</span>
                        ) : (
                          <span className="ml-1 text-xs text-muted-foreground">({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 flex flex-col gap-3">
                  {(() => {
                    const r = providerResults[activeProvider];
                    if (!r) return null;
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
                                variant={addForm.translation === opt ? 'default' : 'outline'}
                                size="sm"
                                onClick={() =>
                                  setAddForm((prev) => ({ ...prev, translation: opt }))
                                }
                                className="inline-flex items-center gap-2"
                              >
                                <span>{opt}</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(opt, addForm.translationLanguage);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      speak(opt, addForm.translationLanguage);
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !addForm.original.trim() || !addForm.translation.trim()}
          >
            {saving
              ? isEdit
                ? t('modal.saving')
                : t('modal.adding')
              : isEdit
                ? t('modal.save')
                : t('modal.add')}
          </Button>
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
