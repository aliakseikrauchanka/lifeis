import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  fetchTranslations,
  fetchDueCards,
  enrollTranslation,
  unenrollTranslation,
  TranslationData,
  SrsCard,
} from '../api/srs.api';
import { BookPlus, BookX } from 'lucide-react';

export function LibraryPage() {
  const [translations, setTranslations] = useState<TranslationData[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [trans, cards] = await Promise.all([fetchTranslations(), fetchDueCards()]);
      setTranslations(trans);
      // Collect all enrolled translation IDs from cards
      const ids = new Set(cards.map((c: SrsCard) => c.translation._id));
      setEnrolledIds(ids);
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
      if (enrolledIds.has(id)) {
        await unenrollTranslation(id);
        setEnrolledIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await enrollTranslation(id);
        setEnrolledIds((prev) => new Set(prev).add(id));
      }
    } catch (err) {
      console.error('Toggle failed:', err);
    } finally {
      setTogglingId(null);
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
        <p className="text-muted-foreground">No translations yet. Add some from the Agents app.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-2">
      <h2 className="text-lg font-semibold mb-2">
        Your Translations ({translations.length})
      </h2>
      {translations.map((t) => {
        const enrolled = enrolledIds.has(t._id);
        return (
          <Card key={t._id} className={enrolled ? 'border-primary/30 bg-primary/5' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{t.original}</div>
                <div className="text-sm text-muted-foreground truncate">{t.translation}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.originalLanguage} → {t.translationLanguage}
                </div>
              </div>
              <Button
                variant={enrolled ? 'destructive' : 'default'}
                size="sm"
                className="shrink-0"
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
