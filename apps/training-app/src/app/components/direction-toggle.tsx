import { ArrowRight } from 'lucide-react';
import { useAppDirection } from '../hooks/use-app-direction';
import { useAppLanguages } from '../hooks/use-app-languages';
import { getLanguageFlag, getLanguageLabel } from '../constants/language-options';
import { useI18n } from '../i18n/i18n-context';

export function DirectionToggle() {
  const [direction, setDirection] = useAppDirection();
  const { nativeLanguage, trainingLanguage } = useAppLanguages();
  const { t } = useI18n();

  const from = direction === 'native-to-training' ? nativeLanguage : trainingLanguage;
  const to = direction === 'native-to-training' ? trainingLanguage : nativeLanguage;

  const toggle = () =>
    setDirection(direction === 'native-to-training' ? 'training-to-native' : 'native-to-training');

  const title = t('direction.title', {
    from: getLanguageLabel(from),
    to: getLanguageLabel(to),
  });

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-500/8 transition-colors text-sm"
    >
      <span aria-hidden>{getLanguageFlag(from)}</span>
      <ArrowRight className="h-3.5 w-3.5" />
      <span aria-hidden>{getLanguageFlag(to)}</span>
    </button>
  );
}
