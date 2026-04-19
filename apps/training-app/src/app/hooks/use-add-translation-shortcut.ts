import { useEffect } from 'react';

function isTextEditingTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  return el.isContentEditable;
}

/** Ctrl+A opens “Add translation” everywhere except while typing in an input / contenteditable. */
export function useAddTranslationShortcut(
  enabled: boolean,
  open: () => void,
  modalAlreadyOpen: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'a' && e.key !== 'A') return;
      if (modalAlreadyOpen) return;
      if (isTextEditingTarget(document.activeElement)) return;

      e.preventDefault();
      open();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, open, modalAlreadyOpen]);
}
