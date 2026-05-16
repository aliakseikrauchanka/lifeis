import { useEffect, useRef, useState } from 'react';
import { History, Volume2 } from 'lucide-react';
import { fetchTrainedToday, Rating, SrsCard } from '../api/srs.api';
import { speak } from '../api/tts.api';

const RATING_STYLES: Record<Rating, string> = {
  again: 'bg-red-100 text-red-700 border-red-200',
  hard: 'bg-amber-100 text-amber-700 border-amber-200',
  good: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  easy: 'bg-sky-100 text-sky-700 border-sky-200',
};

export function HeaderTrainedTodayButton() {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<SrsCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchTrainedToday()
      .then(setCards)
      .catch((err) => {
        console.error('Failed to load trained-today cards:', err);
        setError('Failed to load');
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Trained today"
        aria-label="Trained today"
        className="flex items-center justify-center h-7 w-7 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-500/8 transition-colors"
      >
        <History className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Trained today"
          className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-hidden rounded-lg border bg-background shadow-lg flex flex-col"
        >
          <div className="px-3 py-2 border-b text-sm font-semibold flex items-center justify-between">
            <span>Trained today</span>
            {cards && (
              <span className="text-xs font-normal text-muted-foreground">{cards.length}</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
            {error && (
              <p className="px-3 py-4 text-sm text-red-600">{error}</p>
            )}
            {!loading && !error && cards && cards.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No words trained today yet.</p>
            )}
            {!loading && !error && cards && cards.length > 0 && (
              <ul className="divide-y">
                {cards.map((c) => (
                  <li key={c._id} className="px-3 py-2 text-sm flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium truncate">{c.translation.original}</span>
                        <button
                          type="button"
                          onClick={() => speak(c.translation.original, c.translation.originalLanguage)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Speak"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground truncate">{c.translation.translation}</span>
                        <button
                          type="button"
                          onClick={() => speak(c.translation.translation, c.translation.translationLanguage)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Speak"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {c.last_rating && (
                      <span
                        className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded border ${RATING_STYLES[c.last_rating]}`}
                      >
                        {c.last_rating}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
