import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useTranslationAdd } from '../contexts/translation-add.context';
import { useI18n } from '../i18n/i18n-context';

const MIN_LEN = 1;
const MAX_LEN = 500;

interface Position {
  top: number;
  left: number;
}

function getSelectionInfo(): { text: string; position: Position } | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const text = sel.toString().trim();
  if (text.length < MIN_LEN || text.length > MAX_LEN) return null;

  const range = sel.getRangeAt(0);

  const node = range.commonAncestorContainer;
  const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
  if (element?.closest('[data-no-add-selection]')) return null;
  if (element?.closest('input, textarea, [contenteditable="true"]')) return null;

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;

  return {
    text,
    position: {
      top: rect.top + window.scrollY - 40,
      left: rect.left + window.scrollX + rect.width / 2,
    },
  };
}

export function SelectionAddButton() {
  const { t } = useI18n();
  const { open, openForEdit, findByOriginalOrTranslation, isOpen } = useTranslationAdd();
  const [info, setInfo] = useState<{ text: string; position: Position } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInfo(null);
      return;
    }

    let rafId: number | null = null;

    const update = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setInfo(getSelectionInfo());
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setInfo(null);
    };

    document.addEventListener('selectionchange', update);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  if (!info) return null;

  const existing = findByOriginalOrTranslation(info.text);
  const preview = info.text.length > 40 ? info.text.slice(0, 37) + '…' : info.text;

  const handleAdd = () => {
    open({ original: info.text });
    setInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleEdit = () => {
    if (!existing) return;
    openForEdit(existing._id, {
      original: existing.original,
      translation: existing.translation,
      originalLanguage: existing.originalLanguage,
      translationLanguage: existing.translationLanguage,
    });
    setInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[60] flex items-center gap-1 rounded-md shadow-lg overflow-hidden -translate-x-1/2 text-white text-xs font-medium"
      style={{ top: `${info.position.top}px`, left: `${info.position.left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={handleAdd}
        title={t('selection.addTitle', { preview })}
        className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-700 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('selection.add')}
      </button>
      {existing && (
        <button
          type="button"
          onClick={handleEdit}
          title={t('selection.editTitle', { preview })}
          className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          {t('selection.edit')}
        </button>
      )}
    </div>
  );
}
