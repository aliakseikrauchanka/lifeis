import React, { useState, KeyboardEvent, useEffect, useCallback } from 'react';
import { ImagePreviewFromBuffer, OwnButton, SpeechToText } from '@lifeis/common-ui';
import { CameraAlt } from '@mui/icons-material';
import { createLog, deleteLog, describeFoodFromImage, updateLog } from '../../api/logs/logs.api';
import css from './log-form.module.scss';
import { Box, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';

export interface IEditLog {
  id: string;
  message: string;
  basket_name: string;
}

interface ILogFormProps {
  onSubmit: () => void;
  editLog?: IEditLog;
  onEditCancel?: () => void;
  baskets: { _id: string; name: string }[];
}

export const LogForm = ({ onSubmit, editLog, onEditCancel, baskets }: ILogFormProps) => {
  const [message, setMessage] = React.useState(editLog?.message ?? '');
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const [isDescribingFood, setIsDescribingFood] = useState(false);
  const [imageBuffer, setImageBuffer] = useState<ArrayBuffer | null>(null);

  // Prefill when entering edit mode
  useEffect(() => {
    if (editLog) {
      setMessage(editLog.message);
      const basket = baskets.find((b) => b.name === editLog.basket_name);
      setSelectedBasketId(basket?._id ?? null);
    } else {
      setMessage('');
      setSelectedBasketId(null);
    }
  }, [editLog, baskets]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleCapture = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;

    const buffer = await file.arrayBuffer();
    setImageBuffer(buffer);
    try {
      setIsDescribingFood(true);
      const { answer } = await describeFoodFromImage(buffer);
      setMessage((prev) => (prev ? `${prev}\n\n${answer}` : answer));
    } catch (err) {
      console.error('Failed to describe food from image', err);
      setImageBuffer(null);
    } finally {
      setIsDescribingFood(false);
      event.target.value = '';
    }
  }, []);

  const clearImage = useCallback(() => setImageBuffer(null), []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
      event.preventDefault();

      try {
        setIsCaptionsNeedClear(true);
        if (editLog) {
          await updateLog(editLog.id, message, selectedBasketId ?? undefined);
          setMessage('');
          setSelectedBasketId(null);
        } else {
          setMessage('');
          setSelectedBasketId(null);
          await createLog(message, selectedBasketId ?? undefined);
        }
        setImageBuffer(null);
        onSubmit();
      } catch (_e) {
        console.log('error happened during fetch');
      }
    },
    [message, editLog, selectedBasketId, onSubmit],
  );

  const handleClearText = () => {
    setMessage('');
    setImageBuffer(null);
    setIsCaptionsNeedClear(true);
  };

  const handleDelete = useCallback(async () => {
    if (!editLog || !window.confirm('Are you sure you want to delete this log?')) return;
    try {
      await deleteLog(editLog.id);
      setMessage('');
      setSelectedBasketId(null);
      onSubmit();
      onEditCancel?.();
    } catch (e) {
      console.log('error happened during delete');
    }
  }, [editLog, onSubmit, onEditCancel]);

  const handleKeyDown = useCallback(
    (e: { key: string; code: string; ctrlKey: boolean; preventDefault: () => void }) => {
      // handle escape key
      if (e.key === 'Escape') {
        setIsListeningFired(false);
      }

      if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmit(e);
        return;
      }
      if (e.code === 'KeyS' && e.ctrlKey) {
        setIsListeningFired(true);
      }
    },
    [handleSubmit],
  );

  // Add document-level event listener
  useEffect(() => {
    const handleDocumentKeyDown = (e: globalThis.KeyboardEvent) => {
      // Convert native KeyboardEvent to React KeyboardEvent-like object
      const reactEvent = {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        preventDefault: () => e.preventDefault(),
      } as KeyboardEvent;

      handleKeyDown(reactEvent);
    };

    document.addEventListener('keydown', handleDocumentKeyDown);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [message, onSubmit, handleKeyDown]); // Include dependencies that handleKeyDown uses

  return (
    <form onSubmit={handleSubmit}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: 2,
          borderRadius: 2,
          border: '1px solid #ccc',
          backgroundColor: '#fafafa',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'relative', width: '100%' }}>
          <TextField
            className={css.textAreaField}
            multiline
            rows={2}
            variant="outlined"
            name="message"
            placeholder="Enter your message here"
            value={message}
            onChange={handleChange}
            fullWidth
            sx={{ '& .MuiOutlinedInput-root': { backgroundColor: 'white' } }}
          />
          {imageBuffer && (
            <Box sx={{ position: 'absolute', bottom: 8, right: 8, zIndex: 1 }}>
              <ImagePreviewFromBuffer buffer={imageBuffer} onClose={clearImage} isLoading={isDescribingFood} />
            </Box>
          )}
        </Box>

        <FormControl size="small" sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { backgroundColor: 'white' } }}>
          <InputLabel id="log-form-basket-label">Basket (optional)</InputLabel>
          <Select
            labelId="log-form-basket-label"
            value={selectedBasketId ?? ''}
            label="Basket (optional)"
            onChange={(e) => setSelectedBasketId(e.target.value || null)}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {baskets.map((b) => (
              <MenuItem key={b._id} value={b._id}>
                {b.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SpeechToText
            onCaption={(caption) => setMessage(caption?.join(' ') || '')}
            onCleared={() => setIsCaptionsNeedClear(false)}
            isNeedClear={isCaptionsNeedClear}
            id="logger"
            isToggledListening={isListeningFired}
            onListeningToggled={() => setIsListeningFired((prev) => !prev)}
            showPlayButton={false}
          />
          <label htmlFor="log-form-photo" className={css.photoButton}>
            <CameraAlt fontSize="large" color="inherit" />
            {isDescribingFood && <span className={css.photoLoading}>...</span>}
          </label>
          <input
            type="file"
            id="log-form-photo"
            capture="environment"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleCapture}
            disabled={isDescribingFood}
          />
          {editLog && onEditCancel && (
            <OwnButton type="button" onClick={onEditCancel}>
              Cancel
            </OwnButton>
          )}
          {editLog && (
            <OwnButton type="button" color="danger" onClick={handleDelete}>
              Delete
            </OwnButton>
          )}
          <OwnButton type="submit" disabled={!message}>
            {editLog ? 'Update' : 'Submit'}
          </OwnButton>
          {!editLog && (
            <OwnButton type="button" color="danger" onClick={handleClearText} disabled={!message && !imageBuffer}>
              Clear All
            </OwnButton>
          )}
        </Stack>
      </Box>
    </form>
  );
};
