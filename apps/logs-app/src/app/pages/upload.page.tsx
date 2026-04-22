import { useState, useCallback, useRef } from 'react';
import { Button, Select, MenuItem, FormControl, InputLabel, LinearProgress, TextField } from '@mui/material';
import { useBaskets } from '../hooks/use-baskets';
import { transcribeAudioFiles, TranscribeResult } from '../api/logs/transcribe.api';
import { deleteLog, updateLog } from '../api/logs/logs.api';
import { parseDjiTimestampToIso } from '../utils/parse-dji-timestamp';
import css from './upload.page.module.scss';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const UploadPage = () => {
  const { baskets } = useBaskets();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [basketId, setBasketId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<TranscribeResult[]>([]);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveResult = useCallback(async (index: number, logId?: string) => {
    if (!logId) return;
    if (!window.confirm('Delete this log?')) return;
    try {
      await deleteLog(logId);
      setResults((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const handleStartEdit = useCallback((index: number, message: string) => {
    setEditingIndex(index);
    setEditDraft(message);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditDraft('');
  }, []);

  const handleSaveEdit = useCallback(
    async (index: number, logId?: string, basketIdOfLog?: string) => {
      if (!logId) return;
      try {
        await updateLog(logId, editDraft, basketIdOfLog);
        setResults((prev) => prev.map((r, i) => (i === index ? { ...r, message: editDraft } : r)));
        setEditingIndex(null);
        setEditDraft('');
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [editDraft],
  );

  const acceptFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      const isAudio =
        file.type.startsWith('audio/') || /\.(wav|mp3|m4a|ogg|flac|aac|webm)$/i.test(file.name);
      if (!isAudio) {
        errors.push(`${file.name}: not an audio file`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    setError(errors.length > 0 ? errors.join('\n') : '');
    setSelectedFiles(validFiles);
    setResults([]);
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      acceptFiles(Array.from(event.target.files || []));
    },
    [acceptFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) acceptFiles(files);
    },
    [acceptFiles],
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError('');
    setResults([]);

    try {
      const timestamps: Record<string, string> = {};
      selectedFiles.forEach((file) => {
        const iso = parseDjiTimestampToIso(file.name);
        if (iso) timestamps[file.name] = iso;
      });
      const response = await transcribeAudioFiles(selectedFiles, basketId || undefined, timestamps);
      setResults(response.results);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, basketId]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={css.uploadPage}>
      <h2>Upload WAV Files</h2>

      <div className={css.uploadForm}>
        <div
          className={`${css.dropZone} ${isDragging ? css.dropZoneActive : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
        >
          <p>Drag & drop audio files here, or click to select</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.WAV,.mp3,.m4a,.ogg,.flac,.aac,.webm"
            multiple
            onChange={handleFileSelect}
            className={css.fileInput}
          />
        </div>

        <FormControl size="small" className={css.basketSelect}>
          <InputLabel>Basket (auto if empty)</InputLabel>
          <Select
            value={basketId}
            onChange={(e) => setBasketId(e.target.value as string)}
            label="Basket (auto if empty)"
          >
            <MenuItem value="">Auto-detect</MenuItem>
            {baskets.map((basket) => (
              <MenuItem key={basket._id} value={basket._id}>
                {basket.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedFiles.length > 0 && (
          <div className={css.fileList}>
            <strong>{selectedFiles.length} file(s) selected:</strong>
            <ul>
              {selectedFiles.map((file, index) => (
                <li key={index}>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
                  <button className={css.removeBtn} onClick={() => handleRemoveFile(index)}>
                    x
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          className={css.uploadBtn}
        >
          {isUploading ? 'Transcribing...' : `Upload & Transcribe (${selectedFiles.length})`}
        </Button>

        {isUploading && <LinearProgress className={css.progress} />}
      </div>

      {error && <div className={css.error}>{error}</div>}

      {results.length > 0 && (
        <div className={css.results}>
          <h3>Results</h3>
          <ul className={css.resultsList}>
            {results.map((r, i) => (
              <li key={i} className={r.error ? css.resultError : css.resultSuccess}>
                <div className={css.resultHeader}>
                  <strong>{r.filename}</strong>
                  {!r.error && r.log_id && editingIndex !== i && (
                    <span className={css.resultActions}>
                      <Button size="small" onClick={() => handleStartEdit(i, r.message)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleRemoveResult(i, r.log_id)}>
                        Remove
                      </Button>
                    </span>
                  )}
                </div>
                {r.error ? (
                  <span className={css.errorText}> - Error: {r.error}</span>
                ) : editingIndex === i ? (
                  <div className={css.editBox}>
                    <TextField
                      multiline
                      fullWidth
                      minRows={2}
                      size="small"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                    />
                    <div className={css.editActions}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSaveEdit(i, r.log_id, r.basket_id)}
                      >
                        Save
                      </Button>
                      <Button size="small" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={css.transcript}>{r.message}</div>
                    <small>{new Date(r.timestamp).toLocaleString()}</small>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
