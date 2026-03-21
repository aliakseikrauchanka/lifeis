import { useState, useCallback, useRef } from 'react';
import { Button, Select, MenuItem, FormControl, InputLabel, LinearProgress } from '@mui/material';
import { useBaskets } from '../hooks/use-baskets';
import { transcribeAudioFiles, TranscribeResult } from '../api/logs/transcribe.api';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError('');
    }

    setSelectedFiles(validFiles);
    setResults([]);
  }, []);

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
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.WAV"
          multiple
          onChange={handleFileSelect}
          className={css.fileInput}
        />

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
                <strong>{r.filename}</strong>
                {r.error ? (
                  <span className={css.errorText}> - Error: {r.error}</span>
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
