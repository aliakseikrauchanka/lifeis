'use client';

import { useSpeechToText } from '../../contexts/speech-to-text.context';
import { OwnButton } from '../button/button';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ISpeechToTextProps {
  id: string;
  isNeedClear?: boolean;
  isToggledListening?: boolean;
  className?: string;
  onCaption: (caption: string[] | undefined) => void;
  onCleared?: () => void;
  onListeningToggled?: () => void;
}

export const SpeechToText = ({
  id,
  className,
  isNeedClear,
  isToggledListening,
  onCaption,
  onCleared,
  onListeningToggled,
}: ISpeechToTextProps) => {
  const { startListening, pauseListening, stopListening, caption, connectionReady } = useSpeechToText();
  const [isRecording, setIsRecording] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isNeedClear) {
      onCleared?.();
      setIsRecording(false);
      stopListening(id);
    }
  }, [isNeedClear, onCleared, stopListening, id]);

  const handleStartListening = useCallback(() => {
    startListening(id);
    setIsRecording(true);
    timeoutRef.current = setTimeout(() => {
      stopListening(id);
      setIsRecording(false);
    }, 30000);
  }, [id, startListening, stopListening]);

  const handlePauseListening = useCallback(() => {
    pauseListening();
    setIsRecording(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [pauseListening]);

  useEffect(() => {
    if (isToggledListening) {
      onListeningToggled?.();
      if (isRecording) {
        handlePauseListening();
      } else {
        handleStartListening();
      }
    }
  }, [isToggledListening, onListeningToggled, handlePauseListening, handleStartListening, isRecording]);

  useEffect(() => {
    onCaption(caption[id]);
  }, [caption[id]]);

  return (
    <div className={className}>
      <OwnButton
        type="button"
        color="success"
        onClick={handleStartListening}
        disabled={!connectionReady || (connectionReady && isRecording)}
      >
        Record
      </OwnButton>

      <OwnButton
        type="button"
        color="success"
        onClick={handlePauseListening}
        disabled={!isRecording || !connectionReady}
      >
        Pause
      </OwnButton>
    </div>
  );
};
