import { Plus } from 'lucide-react';
import { useTranslationAdd } from '../contexts/translation-add.context';

export function HeaderAddButton() {
  const { open } = useTranslationAdd();
  return (
    <button
      type="button"
      onClick={() => open()}
      title="Add translation"
      aria-label="Add translation"
      className="flex items-center justify-center h-7 w-7 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-500/8 transition-colors"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
