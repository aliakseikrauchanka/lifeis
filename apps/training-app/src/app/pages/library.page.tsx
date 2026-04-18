import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  fetchTranslations,
  fetchEnrolledCards,
  enrollTranslation,
  enrollTranslationsBatch,
  unenrollTranslation,
  importTranslations,
  deleteTranslation,
  updateTranslation,
  createTranslation,
  translateTextMulti,
  TranslationData,
  SrsCard,
  TranslationProvider,
  ProviderTranslationResult,
} from '../api/srs.api';
import { useNavigate } from 'react-router-dom';
import { BookPlus, BookX, Clock, Upload, Trash2, Search, Plus, ArrowUpDown, Languages, X, Pencil, Check, Sparkles, PenLine, Volume2 } from 'lucide-react';
import { DeepgramFileSTTProvider, useAudioDevices, useSpeechToText } from '@lifeis/common-ui';
import { SpeechInputButton } from '../components/speech-input-button';
import { speak } from '../api/tts.api';

const LANGUAGE_OPTIONS = [
  { code: 'pl', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'sr-RS', label: 'Serbian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'es', label: 'Spanish' },
];

const ORIGINAL_REC_ID = 'library-add-original';
const TRANSLATION_REC_ID = 'library-add-translation';

interface LibraryPageBodyProps {
  onSttLanguageChange: (lang: string | undefined) => void;
}

function LibraryPageBody({ onSttLanguageChange }: LibraryPageBodyProps) {
  const [translations, setTranslations] = useState<TranslationData[]>([]);
  const [enrolledCards, setEnrolledCards] = useState<Map<string, SrsCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ original: '', translation: '' });
  const [enrollingAll, setEnrollingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(() => ({
    original: '',
    translation: '',
    originalLanguage: localStorage.getItem('library-orig-lang') || 'pl',
    translationLanguage: localStorage.getItem('library-trans-lang') || 'ru-RU',
  }));
  const [adding, setAdding] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [providerResults, setProviderResults] = useState<Record<TranslationProvider, ProviderTranslationResult> | null>(null);
  const [activeProvider, setActiveProvider] = useState<TranslationProvider>('openai');
  const [recordingField, setRecordingField] = useState<'original' | 'translation' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { stopListening } = useSpeechToText();

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trans, cards] = await Promise.all([fetchTranslations(), fetchEnrolledCards()]);
      setTranslations(trans);
      const cardMap = new Map(cards.map((c: SrsCard) => [c.translation._id, c]));
      setEnrolledCards(cardMap);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try {
      if (enrolledCards.has(id)) {
        await unenrollTranslation(id);
        setEnrolledCards((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      } else {
        await enrollTranslation(id);
        // Re-fetch to get the new card state
        const cards = await fetchEnrolledCards();
        setEnrolledCards(new Map(cards.map((c: SrsCard) => [c.translation._id, c])));
      }
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTranslation(id);
      setTranslations((prev) => prev.filter((t) => t._id !== id));
      setEnrolledCards((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (t: TranslationData) => {
    setEditingId(t._id);
    setEditForm({ original: t.original, translation: t.translation });
  };

  const handleEditSave = async (id: string) => {
    if (!editForm.original.trim() || !editForm.translation.trim()) return;
    try {
      await updateTranslation(id, { original: editForm.original.trim(), translation: editForm.translation.trim() });
      setTranslations((prev) =>
        prev.map((t) => t._id === id ? { ...t, original: editForm.original.trim(), translation: editForm.translation.trim() } : t)
      );
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update translation:', err);
    }
  };

  const handleAdd = async () => {
    if (!addForm.original.trim() || !addForm.translation.trim()) return;
    setAdding(true);
    try {
      await createTranslation(addForm);
      setAddForm((prev) => ({ ...prev, original: '', translation: '' }));
      setProviderResults(null);
      setShowAddForm(false);
      await load();
    } catch (err) {
      console.error('Failed to add translation:', err);
    } finally {
      setAdding(false);
    }
  };

  const closeAddModal = () => {
    setShowAddForm(false);
    setProviderResults(null);
  };

  useEffect(() => {
    if (!showAddForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAddModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddForm]);

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

  const searchLower = search.toLowerCase();
  const filteredTranslations = search
    ? translations.filter((t) =>
        t.original.toLowerCase().includes(searchLower) ||
        t.translation.toLowerCase().includes(searchLower)
      )
    : translations;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTrainWithSelected = () => {
    if (selectedIds.size === 0) return;
    navigate(`/sentence-training?ids=${Array.from(selectedIds).join(',')}`);
  };

  const handleConstructWithSelected = () => {
    if (selectedIds.size === 0) return;
    navigate(`/sentence-construction?ids=${Array.from(selectedIds).join(',')}`);
  };

  const unenrolledIds = filteredTranslations
    .filter((t) => !enrolledCards.has(t._id))
    .map((t) => t._id);

  const handleEnrollAll = async () => {
    if (unenrolledIds.length === 0) return;
    setEnrollingAll(true);
    try {
      await enrollTranslationsBatch(unenrolledIds);
      const cards = await fetchEnrolledCards();
      setEnrolledCards(new Map(cards.map((c: SrsCard) => [c.translation._id, c])));
    } catch (err) {
      console.error('Failed to enroll all:', err);
    } finally {
      setEnrollingAll(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      // SECURITY FIX: Enforce a client-side file size limit before parsing.
      // JSON.parse on a very large file can crash or hang the browser tab (client-side DoS).
      const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
      if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('File too large (max 5 MB)');

      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error('File must contain a JSON array');

      // SECURITY FIX: Enforce item count limit client-side to avoid sending a huge
      // request body. The backend also enforces 500, but trimming here prevents an
      // unnecessarily large network request.
      const MAX_ITEMS = 500;
      if (items.length > MAX_ITEMS) throw new Error(`Too many items (max ${MAX_ITEMS})`);

      const result = await importTranslations(items);
      setImportResult(`Imported ${result.inserted} words (${result.skipped} skipped)`);
      await load();
    } catch (err) {
      console.error('Import failed:', err);
      setImportResult('Import failed. Check file format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (translations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
        <p className="text-muted-foreground">No translations yet. Add some from the Agents app or import a file.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="gap-1"
        >
          <Upload className="h-4 w-4" />
          {importing ? 'Importing...' : 'Import from File'}
        </Button>
        {importResult && (
          <p className="text-sm text-muted-foreground">{importResult}</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-2">
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search translations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background"
        />
      </div>
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAddModal();
          }}
        >
          <div
            className="relative flex flex-col w-full max-w-2xl h-[85vh] max-h-[700px] bg-background rounded-lg shadow-lg border overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-translation-title"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 id="add-translation-title" className="text-base font-semibold">Add translation</h3>
              <Button variant="ghost" size="sm" onClick={closeAddModal} title="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col flex-1 min-h-0"><div className="flex flex-col gap-2 p-4 pb-2 shrink-0">
              <div className="flex gap-2">
                <div className="flex flex-1 gap-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Original word..."
                      value={addForm.original}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, original: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && addForm.original.trim() && !translating) {
                          e.preventDefault();
                          handleTranslate();
                        }
                      }}
                      className={`w-full pl-3 py-2 text-sm rounded-md border border-input bg-background ${addForm.original ? 'pr-16' : 'pr-3'}`}
                    />
                    {addForm.original && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setAddForm((prev) => ({ ...prev, original: '' }));
                            stopListening(ORIGINAL_REC_ID);
                          }}
                          title="Clear"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => speak(addForm.original, addForm.originalLanguage)}
                          title="Speak"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <SpeechInputButton
                    id={ORIGINAL_REC_ID}
                    onAppend={handleAppendOriginal}
                    disabled={recordingField === 'translation'}
                    onStart={() => setRecordingField('original')}
                    onStop={() => setRecordingField(null)}
                    active={recordingField !== 'translation'}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-2"
                    onClick={handleTranslate}
                    disabled={translating || !addForm.original.trim()}
                    title="Suggest translations from OpenAI, DeepSeek and Glosbe (Enter)"
                  >
                    <Languages className="h-4 w-4" />
                  </Button>
                </div>
                <select
                  value={addForm.originalLanguage}
                  onChange={(e) => { localStorage.setItem('library-orig-lang', e.target.value); setAddForm((prev) => ({ ...prev, originalLanguage: e.target.value })); }}
                  className="px-2 py-2 text-sm rounded-md border border-input bg-background"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 px-2"
                  onClick={() => setAddForm((prev) => {
                    localStorage.setItem('library-orig-lang', prev.translationLanguage);
                    localStorage.setItem('library-trans-lang', prev.originalLanguage);
                    return {
                      original: prev.translation,
                      translation: prev.original,
                      originalLanguage: prev.translationLanguage,
                      translationLanguage: prev.originalLanguage,
                    };
                  })}
                  title="Swap languages"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 gap-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Translation..."
                      value={addForm.translation}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, translation: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                      className={`w-full pl-3 py-2 text-sm rounded-md border border-input bg-background ${addForm.translation ? 'pr-16' : 'pr-3'}`}
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
                          title="Clear"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => speak(addForm.translation, addForm.translationLanguage)}
                          title="Speak"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <SpeechInputButton
                    id={TRANSLATION_REC_ID}
                    onAppend={handleAppendTranslation}
                    disabled={recordingField === 'original'}
                    onStart={() => setRecordingField('translation')}
                    onStop={() => setRecordingField(null)}
                    active={recordingField !== 'original'}
                  />
                </div>
                <select
                  value={addForm.translationLanguage}
                  onChange={(e) => { localStorage.setItem('library-trans-lang', e.target.value); setAddForm((prev) => ({ ...prev, translationLanguage: e.target.value })); }}
                  className="px-2 py-2 text-sm rounded-md border border-input bg-background"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              {translating && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Fetching suggestions from OpenAI, DeepSeek and Glosbe...
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
                        return <p className="text-sm text-red-600">Error: {r.error}</p>;
                      }
                      if (r.translations.length === 0) {
                        return <p className="text-sm text-muted-foreground">No translations returned.</p>;
                      }
                      return (
                        <>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">Translations</span>
                            <div className="flex flex-wrap gap-1">
                              {r.translations.map((opt, i) => (
                                <Button
                                  key={`${activeProvider}-t-${i}`}
                                  variant={addForm.translation === opt ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setAddForm((prev) => ({ ...prev, translation: opt }))}
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          </div>
                          {r.examples && r.examples.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground uppercase">Examples</span>
                              <ul className="flex flex-col gap-1.5">
                                {r.examples.map((ex, i) => (
                                  <li key={`${activeProvider}-e-${i}`} className="text-sm">
                                    <div className="font-medium">{ex.original}</div>
                                    <div className="text-muted-foreground">{ex.translated}</div>
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
              <Button size="sm" variant="ghost" onClick={closeAddModal}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding || !addForm.original.trim() || !addForm.translation.trim()}>
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h2 className="text-lg font-semibold whitespace-nowrap">
          {search ? `${filteredTranslations.length} of ${translations.length}` : translations.length} Translations
        </h2>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm((v) => !v)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-1"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
          {unenrolledIds.length > 0 && (
            <Button
              size="sm"
              onClick={handleEnrollAll}
              disabled={enrollingAll}
              className="gap-1"
            >
              <BookPlus className="h-4 w-4" />
              {enrollingAll ? 'Enrolling...' : `Enroll All (${unenrolledIds.length})`}
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleTrainWithSelected} className="gap-1">
              <Sparkles className="h-4 w-4" />
              Train with selected ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={handleConstructWithSelected} className="gap-1">
              <PenLine className="h-4 w-4" />
              Construct with selected ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>
      {importResult && (
        <p className="text-sm text-muted-foreground mb-2">{importResult}</p>
      )}
      {filteredTranslations.map((t) => {
        const card = enrolledCards.get(t._id);
        const enrolled = !!card;
        const isDue = enrolled && card.due_at <= Date.now();
        return (
          <Card key={t._id} className={enrolled ? 'border-primary/30 bg-primary/5' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              {isDue && (
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={selectedIds.has(t._id)}
                  onChange={() => toggleSelected(t._id)}
                  title="Select for sentence training"
                />
              )}
              <div className="flex-1 min-w-0">
                {editingId === t._id ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={editForm.original}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, original: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(t._id); if (e.key === 'Escape') setEditingId(null); }}
                      className="px-2 py-1 text-sm rounded-md border border-input bg-background font-medium"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editForm.translation}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, translation: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(t._id); if (e.key === 'Escape') setEditingId(null); }}
                      className="px-2 py-1 text-sm rounded-md border border-input bg-background"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {t.originalLanguage} → {t.translationLanguage}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.original}</span>
                      {isDue && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full shrink-0">
                          <Clock className="h-3 w-3" /> Due
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{t.translation}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t.originalLanguage} → {t.translationLanguage}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {editingId === t._id ? (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEditSave(t._id)}
                      title="Save"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={enrolled ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleToggle(t._id)}
                      disabled={togglingId === t._id}
                    >
                      {enrolled ? (
                        <>
                          <BookX className="h-4 w-4 mr-1" /> Remove
                        </>
                      ) : (
                        <>
                          <BookPlus className="h-4 w-4 mr-1" /> Add to Deck
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(t)}
                      title="Edit translation"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(t._id)}
                      disabled={deletingId === t._id}
                      title="Delete translation"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function LibraryPage() {
  const [sttLanguage, setSttLanguage] = useState<string | undefined>(undefined);
  const { inputDeviceId, outputDeviceId } = useAudioDevices();
  return (
    <DeepgramFileSTTProvider
      language={sttLanguage}
      audioInputDeviceId={inputDeviceId || undefined}
      audioOutputDeviceId={outputDeviceId || undefined}
    >
      <LibraryPageBody onSttLanguageChange={setSttLanguage} />
    </DeepgramFileSTTProvider>
  );
}
