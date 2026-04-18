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
  TranslationData,
  SrsCard,
} from '../api/srs.api';
import { useNavigate } from 'react-router-dom';
import { BookPlus, BookX, Clock, Upload, Trash2, Search, Plus, Pencil, Sparkles, PenLine } from 'lucide-react';
import { useTranslationAdd } from '../contexts/translation-add.context';
import { useAppLanguages } from '../hooks/use-app-languages';
import { matchesAppLanguagePair, getLanguageLabel } from '../constants/language-options';

export function LibraryPage() {
  const [translations, setTranslations] = useState<TranslationData[]>([]);
  const [enrolledCards, setEnrolledCards] = useState<Map<string, SrsCard>>(new Map());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enrollingAll, setEnrollingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { open: openAddModal, openForEdit, subscribeChanged, refreshIndex } = useTranslationAdd();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();

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

  useEffect(() => subscribeChanged(() => load()), [subscribeChanged, load]);

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
      refreshIndex();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (t: TranslationData) => {
    openForEdit(t._id, {
      original: t.original,
      translation: t.translation,
      originalLanguage: t.originalLanguage,
      translationLanguage: t.translationLanguage,
    });
  };

  const languageFiltered = translations.filter((t) =>
    matchesAppLanguagePair(t, nativeLanguage, trainingLanguage),
  );
  const searchLower = search.toLowerCase();
  const filteredTranslations = search
    ? languageFiltered.filter((t) =>
        t.original.toLowerCase().includes(searchLower) ||
        t.translation.toLowerCase().includes(searchLower)
      )
    : languageFiltered;
  const hiddenByLanguageCount = translations.length - languageFiltered.length;

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
      const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('File too large (max 5 MB)');

      const text = await file.text();
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error('File must contain a JSON array');

      const MAX_ITEMS = 500;
      if (items.length > MAX_ITEMS) throw new Error(`Too many items (max ${MAX_ITEMS})`);

      const result = await importTranslations(items);
      setImportResult(`Imported ${result.inserted} words (${result.skipped} skipped)`);
      await load();
      refreshIndex();
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
        <p className="text-muted-foreground">No translations yet. Add one or import a file.</p>
        <div className="flex gap-2">
          <Button onClick={() => openAddModal()} className="gap-1">
            <Plus className="h-4 w-4" />
            Add translation
          </Button>
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
        </div>
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
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold whitespace-nowrap">
            {search ? `${filteredTranslations.length} of ${languageFiltered.length}` : languageFiltered.length} Translations
          </h2>
          {hiddenByLanguageCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {hiddenByLanguageCount} hidden · showing {getLanguageLabel(trainingLanguage)} ↔ {getLanguageLabel(nativeLanguage)}
            </span>
          )}
        </div>
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
            onClick={() => openAddModal()}
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
            <CardContent className="flex items-center gap-4 p-4" data-no-add-selection>
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
              </div>
              <div className="flex gap-1 shrink-0">
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
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
