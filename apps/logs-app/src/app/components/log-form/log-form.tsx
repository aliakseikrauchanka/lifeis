import React, { useState, KeyboardEvent, useEffect, useCallback, useRef } from 'react';
import { ImagePreviewFromBuffer, OwnButton, SpeechToText } from '@lifeis/common-ui';
import { CameraAlt, ExpandLess, ExpandMore } from '@mui/icons-material';
import { createLog, describeFromImage, type DescribeFromImageMode, updateLog } from '../../api/logs/logs.api';
import css from './log-form.module.scss';
import { Box, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';

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
  const [isExpanded, setIsExpanded] = useState(true);

  const [message, setMessage] = React.useState(editLog?.message ?? '');
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(null);
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const [isParsingPhoto, setIsParsingPhoto] = useState(false);
  const [imageBuffer, setImageBuffer] = useState<ArrayBuffer | null>(null);
  const [imageMode, setImageMode] = useState<DescribeFromImageMode>('describe-food-ru');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Prefill only when entering/exiting edit mode or switching logs - NOT on expand/shrink
  const editLogId = editLog?.id;
  useEffect(() => {
    if (editLog) {
      setMessage(editLog.message);
      const basket = baskets.find((b) => b.name === editLog.basket_name);
      setSelectedBasketId(basket?._id ?? null);
    } else {
      setMessage('');
      setSelectedBasketId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when log id changes, not on expand/shrink
  }, [editLogId, baskets]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleCapture = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file?.type.startsWith('image/')) return;

      const buffer = await file.arrayBuffer();
      setImageBuffer(buffer);
      try {
        setIsParsingPhoto(true);
        const { answer } = await describeFromImage(buffer, imageMode);
        setMessage((prev) => (prev ? `${prev}\n\n${answer}` : answer));
      } catch (err) {
        console.error('Failed to parse photo', err);
        setImageBuffer(null);
      } finally {
        setIsParsingPhoto(false);
        event.target.value = '';
      }
    },
    [imageMode],
  );

  const clearImage = useCallback(() => setImageBuffer(null), []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement> | React.KeyboardEvent | { preventDefault: () => void }) => {
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
      } catch {
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

  const actionButtons = (
    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap className={css.actionButtons}>
      <SpeechToText
        onCaption={(caption) => setMessage(caption?.join(' ') || '')}
        onCleared={() => setIsCaptionsNeedClear(false)}
        isNeedClear={isCaptionsNeedClear}
        id="logger"
        isToggledListening={isListeningFired}
        onListeningToggled={() => setIsListeningFired((prev) => !prev)}
        maxRecordingDurationMs={90_000}
      />
      <Box display="flex" alignItems="center" gap={0.5}>
        <label htmlFor="log-form-photo" className={css.photoButton}>
          <CameraAlt fontSize="large" color="inherit" />
          {isParsingPhoto && <span className={css.photoLoading}>...</span>}
        </label>
        <FormControl size="small" className={css.basketSelect} disabled={isParsingPhoto}>
          <InputLabel id="log-form-image-mode-label">Mode</InputLabel>
          <Select
            labelId="log-form-image-mode-label"
            value={imageMode}
            label="Mode"
            onChange={(e) => setImageMode(e.target.value as DescribeFromImageMode)}
            sx={{ minWidth: 160, fontSize: '0.75rem', height: 40 }}
          >
            <MenuItem value="describe-food-ru">Describe food (RU)</MenuItem>
            <MenuItem value="get-text">Get text</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <input
        type="file"
        id="log-form-photo"
        capture="environment"
        accept="image/*"
        className={css.fileInput}
        onChange={handleCapture}
        disabled={isParsingPhoto}
      />
      <Box className={css.actionsSpacer} />
      {!editLog && (
        <OwnButton type="button" color="danger" onClick={handleClearText} disabled={!message && !imageBuffer}>
          Clear All
        </OwnButton>
      )}
      {editLog && onEditCancel && (
        <OwnButton type="button" color="danger" onClick={onEditCancel}>
          Cancel
        </OwnButton>
      )}
      <OwnButton type="submit" disabled={!message}>
        {editLog ? 'Update' : 'Submit'}
      </OwnButton>
    </Stack>
  );

  const compact = !isExpanded;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Box id="log-form-details" className={`${css.formContainer} ${compact ? css.formCompact : ''}`}>
          <Box className={css.textFieldWrapper}>
            <TextField
              inputRef={textareaRef}
              className={css.textAreaField}
              multiline
              rows={compact ? 1 : imageBuffer ? 3 : 2}
              variant="outlined"
              name="message"
              placeholder="Enter your message here"
              value={message}
              onChange={handleChange}
              fullWidth
            />
            {imageBuffer && (
              <Box className={css.imagePreviewBox}>
                <ImagePreviewFromBuffer buffer={imageBuffer} onClose={clearImage} isLoading={isParsingPhoto} />
              </Box>
            )}
          </Box>

          <FormControl size="small" className={css.basketSelect}>
            <InputLabel id="log-form-basket-label">{compact ? 'Basket' : 'Basket (optional)'}</InputLabel>
            <Select
              labelId="log-form-basket-label"
              value={selectedBasketId ?? ''}
              label={compact ? 'Basket' : 'Basket (optional)'}
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
          {compact ? <Box className={css.compactButtonsRow}>{actionButtons}</Box> : actionButtons}
        </Box>
      </form>
      <div className={css.expandButtonRow}>
        <IconButton
          size="small"
          className={css.expandButton}
          onClick={() => setIsExpanded((v: boolean) => !v)}
          aria-expanded={isExpanded}
          aria-controls="log-form-details"
          aria-label={isExpanded ? 'Shrink form' : 'Expand form'}
          title={isExpanded ? 'Shrink form to show more logs' : 'Expand form'}
        >
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </div>
    </>
  );
};
