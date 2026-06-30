import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Brain, PenLine, Blocks, Type, ChevronDown, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/messages';

interface TrainingItem {
  to: string;
  end?: boolean;
  labelKey: MessageKey;
  Icon: LucideIcon;
}

const TRAINING_ITEMS: TrainingItem[] = [
  { to: '/', end: true, labelKey: 'nav.study', Icon: BookOpen },
  { to: '/sentence-training', labelKey: 'nav.sentenceTraining', Icon: Brain },
  { to: '/sentence-construction', labelKey: 'nav.sentenceConstruction', Icon: PenLine },
  { to: '/sentence-builder', labelKey: 'nav.sentenceBuilder', Icon: Blocks },
  { to: '/word-builder', labelKey: 'nav.wordBuilder', Icon: Type },
];

export function TrainingMenu() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The active training defaults to Study when the current route is not a training page (e.g. Library).
  const active = TRAINING_ITEMS.find((item) => pathname === item.to) ?? TRAINING_ITEMS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const ActiveIcon = active.Icon;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t(active.labelKey)}
        className="px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 text-violet-700 hover:text-violet-900 hover:bg-violet-500/8"
      >
        <ActiveIcon className="h-4 w-4 md:hidden" />
        <span className="hidden md:inline">{t(active.labelKey)}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[12rem] rounded-lg border bg-background shadow-lg overflow-hidden">
          {TRAINING_ITEMS.map(({ to, end, labelKey, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  isActive
                    ? 'text-violet-900 bg-violet-500/12 font-semibold'
                    : 'text-violet-700 hover:bg-violet-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t(labelKey)}</span>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
