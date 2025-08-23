import React, { useState, KeyboardEvent, KeyboardEventHandler, useEffect, useCallback } from 'react';
import { OwnButton, SpeechToText } from '@lifeis/common-ui';
import { createLog } from '../../api/logs/logs.api';
import css from './log-form.module.scss';
import { Box, Stack, TextField } from '@mui/material';

interface ILogFormProps {
  onSubmit: () => void;
}

export const LogForm = ({ onSubmit }: ILogFormProps) => {
  const [message, setMessage] = React.useState('');
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
      event.preventDefault();

      try {
        setIsCaptionsNeedClear(true);
        setMessage('');
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
        }}
      >
        <TextField
          multiline
          minRows={3}
          maxRows={6}
          variant="outlined"
          name="message"
          placeholder="Enter your message here"
          value={message}
          onChange={handleChange}
          // onKeyDown={handleKeyDown}
          fullWidth
        />

        <SpeechToText
          onCaption={(caption) => setMessage(caption?.join(' ') || '')}
          onCleared={() => setIsCaptionsNeedClear(false)}
          isNeedClear={isCaptionsNeedClear}
          id="logger"
          isToggledListening={isListeningFired}
          onListeningToggled={() => setIsListeningFired((prev) => !prev)}
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
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
