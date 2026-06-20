import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useI18n } from '../i18n/i18n-context';
import type { ImportPreviewResult } from '../api/srs.api';

export interface ImportPreviewDialogProps {
  preview: ImportPreviewResult;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({ preview, loading, onConfirm, onCancel }: ImportPreviewDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-md max-h-[80vh] bg-background rounded-lg shadow-lg border overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-preview-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 id="import-preview-title" className="text-base font-semibold">
            {t('import.previewTitle')}
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            {t('import.previewSummary', {
              new: preview.toImportCount,
              existing: preview.duplicates.length,
              skipped: preview.skipped.length,
            })}
          </p>

          {preview.duplicates.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {t('import.alreadyInLibrary')}
              </span>
              <ul className="flex flex-wrap gap-1">
                {preview.duplicates.map((w, i) => (
                  <li
                    key={`dup-${i}`}
                    className="text-xs bg-muted px-2 py-0.5 rounded-full"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.skipped.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {t('import.skippedHeading')}
              </span>
              <ul className="flex flex-wrap gap-1">
                {preview.skipped.map((w, i) => (
                  <li
                    key={`skip-${i}`}
                    className="text-xs bg-muted px-2 py-0.5 rounded-full"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
            {t('import.cancel')}
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={loading || preview.toImportCount === 0}>
            {loading ? t('import.checking') : t('import.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
