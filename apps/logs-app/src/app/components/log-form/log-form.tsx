import React, { useState, KeyboardEvent, useEffect, useCallback } from 'react';
import { ImagePreviewFromBuffer, OwnButton, SpeechToText } from '@lifeis/common-ui';
import { CameraAlt } from '@mui/icons-material';
import { createLog, describeFoodFromImage } from '../../api/logs/logs.api';
import css from './log-form.module.scss';
import { Box, Stack, TextField } from '@mui/material';

interface ILogFormProps {
  onSubmit: () => void;
}

export const LogForm = ({ onSubmit }: ILogFormProps) => {
  const [message, setMessage] = React.useState('');
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const [isDescribingFood, setIsDescribingFood] = useState(false);
  const [imageBuffer, setImageBuffer] = useState<ArrayBuffer | null>(null);

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
        setMessage('');
        setImageBuffer(null);
        await createLog(message);
        onSubmit();
      } catch (e) {
        console.log('error happened during fetch');
      }
    },
    [message, onSubmit],
  );

  const handleClearText = () => {
    setMessage('');
    setImageBuffer(null);
    setIsCaptionsNeedClear(true);
  };

  const handleKeyDown = useCallback(
    (e: any) => {
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
          />
          {imageBuffer && (
            <Box sx={{ position: 'absolute', bottom: 8, right: 8, zIndex: 1 }}>
              <ImagePreviewFromBuffer buffer={imageBuffer} onClose={clearImage} isLoading={isDescribingFood} />
            </Box>
          )}
        </Box>

        <SpeechToText
          onCaption={(caption) => setMessage(caption?.join(' ') || '')}
          onCleared={() => setIsCaptionsNeedClear(false)}
          isNeedClear={isCaptionsNeedClear}
          id="logger"
          isToggledListening={isListeningFired}
          onListeningToggled={() => setIsListeningFired((prev) => !prev)}
        />

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
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
          <Box sx={{ flex: 1 }} />
          <OwnButton type="submit" disabled={!message}>
            Submit
          </OwnButton>
          <OwnButton type="button" color="danger" onClick={handleClearText} disabled={!message}>
            Clear All
          </OwnButton>
        </Stack>
      </Box>
    </form>
  );
};
