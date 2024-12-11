'use client';

import { useSpeechToText } from '../../contexts/speech-to-text.context';
import { OwnButton } from '../button/button';
import { useEffect, useRef, useState } from 'react';

interface ISpeechToTextProps {
  id: string;
  isNeedClear?: boolean;
  className?: string;
  onCaption: (caption: string[] | undefined) => void;
  onCleared?: () => void;
}

export const SpeechToText = ({ id, className, isNeedClear, onCaption, onCleared }: ISpeechToTextProps) => {
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

  const handleStartListening = () => {
    startListening(id);
    setIsRecording(true);
    timeoutRef.current = setTimeout(() => {
      stopListening(id);
      setIsRecording(false);
    }, 30000);
  };

  const handlePauseListening = () => {
    pauseListening();
    setIsRecording(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

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
