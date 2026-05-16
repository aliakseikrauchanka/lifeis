import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Volume2 } from 'lucide-react';
import { fetchTrainedToday, Rating, SrsCard } from '../api/srs.api';
import { speak } from '../api/tts.api';

const RATING_STYLES: Record<Rating, string> = {
  again: 'bg-red-100 text-red-700 border-red-200',
  hard: 'bg-amber-100 text-amber-700 border-amber-200',
  good: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  easy: 'bg-sky-100 text-sky-700 border-sky-200',
};

const POPOVER_MARGIN = 12;
const POPOVER_GAP = 4;
const POPOVER_MAX_WIDTH = 320;

function clampPopoverLeft(left: number, width: number, vw: number): number {
  const maxLeft = vw - POPOVER_MARGIN - width;
  return Math.max(POPOVER_MARGIN, Math.min(left, maxLeft));
}

export function HeaderTrainedTodayButton() {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<SrsCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverLayout, setPopoverLayout] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updatePopoverLayout = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn || !open) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(POPOVER_MAX_WIDTH, vw - 2 * POPOVER_MARGIN);
    const left = clampPopoverLeft(rect.right - width, width, vw);
    const top = rect.bottom + POPOVER_GAP;
    setPopoverLayout({ top, left, width });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverLayout();
  }, [open, updatePopoverLayout]);

  useEffect(() => {
    if (!open) {
      setPopoverLayout(null);
      return;
    }
    const onResizeOrScroll = () => updatePopoverLayout();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, updatePopoverLayout]);

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
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
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
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Trained today"
        aria-label="Trained today"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-violet-700 transition-colors hover:bg-violet-500/8 hover:text-violet-900"
      >
        <History className="h-4 w-4" />
      </button>
      {open &&
        popoverLayout &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Trained today"
            className="fixed z-50 flex max-h-[min(24rem,70dvh)] min-h-0 flex-col rounded-lg border bg-background shadow-lg"
            style={{
              top: popoverLayout.top,
              left: popoverLayout.left,
              width: popoverLayout.width,
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2 text-sm font-semibold">
              <span>Trained today</span>
              {cards && (
                <span className="text-xs font-normal text-muted-foreground">{cards.length}</span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {error && <p className="px-4 py-4 text-sm text-red-600">{error}</p>}
              {!loading && !error && cards && cards.length === 0 && (
                <p className="px-4 py-4 text-sm text-muted-foreground">No words trained today yet.</p>
              )}
              {!loading && !error && cards && cards.length > 0 && (
                <ul className="divide-y">
                  {cards.map((c) => (
                    <li
                      key={c._id}
                      className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                            {c.translation.original}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              speak(c.translation.original, c.translation.originalLanguage)
                            }
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Speak"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 flex-1 break-words leading-snug text-muted-foreground">
                            {c.translation.translation}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              speak(c.translation.translation, c.translation.translationLanguage)
                            }
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Speak"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {c.last_rating && (
                        <span
                          className={`self-start rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:shrink-0 ${RATING_STYLES[c.last_rating]}`}
                        >
                          {c.last_rating}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
