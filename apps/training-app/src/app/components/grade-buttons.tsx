import { Button } from './ui/button';
import { Rating } from '../api/srs.api';
import { useI18n } from '../i18n/i18n-context';

interface GradeButtonsProps {
  onGrade: (rating: Rating) => void;
  disabled?: boolean;
  showHotkeys?: boolean;
  selected?: Rating;
}

export function GradeButtons({ onGrade, disabled, showHotkeys, selected }: GradeButtonsProps) {
  const { t } = useI18n();
  return (
    <div className="flex justify-center gap-2">
      <Button
        variant={selected === 'again' ? 'destructive' : 'destructive'}
        size="sm"
        onClick={() => onGrade('again')}
        disabled={disabled}
        className={`gap-1 ${selected && selected !== 'again' ? 'opacity-40' : ''}`}
      >
        {t('grade.again')}
        {showHotkeys && (
          <kbd className="text-xs px-1 py-0.5 rounded bg-red-800/30 border border-red-400/30">1</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-orange-300 text-orange-700 hover:bg-orange-50 gap-1 ${
          selected && selected !== 'hard' ? 'opacity-40' : ''
        } ${selected === 'hard' ? 'bg-orange-50' : ''}`}
        onClick={() => onGrade('hard')}
        disabled={disabled}
      >
        {t('grade.hard')}
        {showHotkeys && (
          <kbd className="text-xs px-1 py-0.5 rounded bg-orange-100 border border-orange-300">2</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-green-300 text-green-700 hover:bg-green-50 gap-1 ${
          selected && selected !== 'good' ? 'opacity-40' : ''
        } ${selected === 'good' ? 'bg-green-50' : ''}`}
        onClick={() => onGrade('good')}
        disabled={disabled}
      >
        {t('grade.good')}
        {showHotkeys && (
          <kbd className="text-xs px-1 py-0.5 rounded bg-green-100 border border-green-300">3</kbd>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`border-blue-300 text-blue-700 hover:bg-blue-50 gap-1 ${
          selected && selected !== 'easy' ? 'opacity-40' : ''
        } ${selected === 'easy' ? 'bg-blue-50' : ''}`}
        onClick={() => onGrade('easy')}
        disabled={disabled}
      >
        {t('grade.easy')}
        {showHotkeys && (
          <kbd className="text-xs px-1 py-0.5 rounded bg-blue-100 border border-blue-300">4</kbd>
        )}
      </Button>
    </div>
  );
}
