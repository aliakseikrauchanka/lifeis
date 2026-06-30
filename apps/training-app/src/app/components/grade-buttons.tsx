import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Rating } from '../api/srs.api';
import { useI18n } from '../i18n/i18n-context';

interface GradeButtonsProps {
  onGrade: (rating: Rating) => void;
  onMarkLearned?: () => void;
  onUnenroll?: () => void;
  disabled?: boolean;
  showHotkeys?: boolean;
  selected?: Rating;
  showMarkLearned?: boolean;
  showUnenroll?: boolean;
}

export function GradeButtons({
  onGrade,
  onMarkLearned,
  onUnenroll,
  disabled,
  showHotkeys,
  selected,
  showMarkLearned,
  showUnenroll,
}: GradeButtonsProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasSecondary = (showMarkLearned && onMarkLearned) || (showUnenroll && onUnenroll);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [menuOpen]);

  return (
    <div className="flex flex-nowrap justify-center items-center gap-1.5 sm:gap-2 w-full">
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onGrade('again')}
        disabled={disabled}
        className={`gap-1 px-2.5 ${selected && selected !== 'again' ? 'opacity-40' : ''}`}
      >
        {t('grade.again')}
        {showHotkeys && (
          <kbd className="hidden sm:inline-flex text-xs px-1 py-0.5 rounded bg-red-800/30 border border-red-400/30">1</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-orange-300 text-orange-700 hover:bg-orange-50 gap-1 px-2.5 ${
          selected && selected !== 'hard' ? 'opacity-40' : ''
        } ${selected === 'hard' ? 'bg-orange-50' : ''}`}
        onClick={() => onGrade('hard')}
        disabled={disabled}
      >
        {t('grade.hard')}
        {showHotkeys && (
          <kbd className="hidden sm:inline-flex text-xs px-1 py-0.5 rounded bg-orange-100 border border-orange-300">2</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-green-300 text-green-700 hover:bg-green-50 gap-1 px-2.5 ${
          selected && selected !== 'good' ? 'opacity-40' : ''
        } ${selected === 'good' ? 'bg-green-50' : ''}`}
        onClick={() => onGrade('good')}
        disabled={disabled}
      >
        {t('grade.good')}
        {showHotkeys && (
          <kbd className="hidden sm:inline-flex text-xs px-1 py-0.5 rounded bg-green-100 border border-green-300">3</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-blue-300 text-blue-700 hover:bg-blue-50 gap-1 px-2.5 ${
          selected && selected !== 'easy' ? 'opacity-40' : ''
        } ${selected === 'easy' ? 'bg-blue-50' : ''}`}
        onClick={() => onGrade('easy')}
        disabled={disabled}
      >
        {t('grade.easy')}
        {showHotkeys && (
          <kbd className="hidden sm:inline-flex text-xs px-1 py-0.5 rounded bg-blue-100 border border-blue-300">4</kbd>
        )}
      </Button>
      {hasSecondary && (
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={disabled}
            title={t('grade.moreActions')}
            aria-label={t('grade.moreActions')}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1 z-50 min-w-[10rem] rounded-lg border bg-background shadow-lg overflow-hidden p-1 flex flex-col">
              {showMarkLearned && onMarkLearned ? (
                <button
                  type="button"
                  className="flex items-center px-3 py-2 text-sm text-left rounded-md text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkLearned();
                  }}
                  disabled={disabled}
                  title={t('grade.learnedTitle')}
                >
                  {t('grade.learned')}
                </button>
              ) : null}
              {showUnenroll && onUnenroll ? (
                <button
                  type="button"
                  className="flex items-center px-3 py-2 text-sm text-left rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onUnenroll();
                  }}
                  disabled={disabled}
                  title={t('grade.unenrollTitle')}
                >
                  {t('grade.unenroll')}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
