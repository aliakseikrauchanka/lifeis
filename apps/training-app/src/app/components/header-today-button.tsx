import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, History, Volume2 } from 'lucide-react';
import {
  AddedTranslation,
  fetchAddedToday,
  fetchTrainedToday,
  Rating,
  SrsCard,
} from '../api/srs.api';
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

type TabId = 'trained' | 'added';

function clampPopoverLeft(left: number, width: number, vw: number): number {
  const maxLeft = vw - POPOVER_MARGIN - width;
  return Math.max(POPOVER_MARGIN, Math.min(left, maxLeft));
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    'flex-1 rounded-md px-2 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
  const cls = active
    ? `${base} bg-violet-500/10 font-semibold text-violet-900`
    : `${base} text-muted-foreground hover:text-foreground`;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function CopyButton({ onCopy, disabled }: { onCopy: () => void; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleClick = () => {
    onCopy();
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={copied ? 'Copied' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-violet-500/8 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SpeakButton({ text, language }: { text: string; language: string }) {
  return (
    <button
      type="button"
      onClick={() => speak(text, language)}
      className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
      title="Speak"
    >
      <Volume2 className="h-3 w-3" />
    </button>
  );
}

function TrainedRow({ card }: { card: SrsCard }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 break-words font-medium leading-snug">
            {card.translation.original}
          </span>
          <SpeakButton text={card.translation.original} language={card.translation.originalLanguage} />
        </div>
        <div className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 break-words leading-snug text-muted-foreground">
            {card.translation.translation}
          </span>
          <SpeakButton
            text={card.translation.translation}
            language={card.translation.translationLanguage}
          />
        </div>
      </div>
      {card.last_rating && (
        <span
          className={`self-start rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:shrink-0 ${RATING_STYLES[card.last_rating]}`}
        >
          {card.last_rating}
        </span>
      )}
    </li>
  );
}

function AddedRow({ item }: { item: AddedTranslation }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 break-words font-medium leading-snug">{item.original}</span>
          <SpeakButton text={item.original} language={item.originalLanguage} />
        </div>
        <div className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 break-words leading-snug text-muted-foreground">
            {item.translation}
          </span>
          <SpeakButton text={item.translation} language={item.translationLanguage} />
        </div>
      </div>
      {!item.enrolled && (
        <span className="self-start rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 sm:shrink-0">
          not enrolled
        </span>
      )}
    </li>
  );
}

export function HeaderTodayButton() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('trained');

  const [cards, setCards] = useState<SrsCard[] | null>(null);
  const [trainedLoading, setTrainedLoading] = useState(false);
  const [trainedError, setTrainedError] = useState<string | null>(null);

  const [added, setAdded] = useState<AddedTranslation[] | null>(null);
  const [addedLoading, setAddedLoading] = useState(false);
  const [addedError, setAddedError] = useState<string | null>(null);

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
    if (!open) {
      setActiveTab('trained');
      setCards(null);
      setTrainedError(null);
      setAdded(null);
      setAddedError(null);
      return;
    }
    setTrainedLoading(true);
    setTrainedError(null);
    fetchTrainedToday()
      .then(setCards)
      .catch((err) => {
        console.error('Failed to load trained-today cards:', err);
        setTrainedError('Failed to load');
      })
      .finally(() => setTrainedLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || activeTab !== 'added' || added !== null) return;
    setAddedLoading(true);
    setAddedError(null);
    fetchAddedToday()
      .then(setAdded)
      .catch((err) => {
        console.error('Failed to load added-today translations:', err);
        setAddedError('Failed to load');
      })
      .finally(() => setAddedLoading(false));
  }, [open, activeTab, added]);

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

  const copyableLines: string[] | null =
    activeTab === 'trained'
      ? cards?.map((c) => `${c.translation.original}\t${c.translation.translation}`) ?? null
      : added?.map((t) => `${t.original}\t${t.translation}`) ?? null;

  const copyDisabled = !copyableLines || copyableLines.length === 0;

  const handleCopy = useCallback(() => {
    if (!copyableLines || copyableLines.length === 0) return;
    const text = copyableLines.join('\n');
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, [copyableLines]);

  const trainedView = (
    <>
      {trainedLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {trainedError && <p className="px-4 py-4 text-sm text-red-600">{trainedError}</p>}
      {!trainedLoading && !trainedError && cards && cards.length === 0 && (
        <p className="px-4 py-4 text-sm text-muted-foreground">No words trained today yet.</p>
      )}
      {!trainedLoading && !trainedError && cards && cards.length > 0 && (
        <ul className="divide-y">
          {cards.map((c) => (
            <TrainedRow key={c._id} card={c} />
          ))}
        </ul>
      )}
    </>
  );

  const addedView = (
    <>
      {addedLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {addedError && <p className="px-4 py-4 text-sm text-red-600">{addedError}</p>}
      {!addedLoading && !addedError && added && added.length === 0 && (
        <p className="px-4 py-4 text-sm text-muted-foreground">No words added today yet.</p>
      )}
      {!addedLoading && !addedError && added && added.length > 0 && (
        <ul className="divide-y">
          {added.map((t) => (
            <AddedRow key={t._id} item={t} />
          ))}
        </ul>
      )}
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Today"
        aria-label="Today"
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
            aria-label="Today"
            className="fixed z-50 flex max-h-[min(24rem,70dvh)] min-h-0 flex-col rounded-lg border bg-background shadow-lg"
            style={{
              top: popoverLayout.top,
              left: popoverLayout.left,
              width: popoverLayout.width,
            }}
          >
            <div
              role="tablist"
              aria-label="Today views"
              className="flex shrink-0 items-center gap-1 border-b px-2 py-2"
            >
              <TabButton active={activeTab === 'trained'} onClick={() => setActiveTab('trained')}>
                Trained{cards ? <span className="ml-1 text-xs opacity-70">({cards.length})</span> : null}
              </TabButton>
              <TabButton active={activeTab === 'added'} onClick={() => setActiveTab('added')}>
                Added{added ? <span className="ml-1 text-xs opacity-70">({added.length})</span> : null}
              </TabButton>
              <CopyButton onCopy={handleCopy} disabled={copyDisabled} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {activeTab === 'trained' ? trainedView : addedView}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
