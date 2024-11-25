'use client';

import { useSpeechToText } from '../../contexts/speech-to-text.context';
import { OwnButton } from '../button/button';
import { useEffect, useState } from 'react';

interface ISpeechToTextProps {
  id: string;
  isNeedClear?: boolean;
  onCaption: (caption: string[] | undefined) => void;
  onCleared?: () => void;
}

export const SpeechToText = ({ id, isNeedClear, onCaption, onCleared }: ISpeechToTextProps) => {
  const { startListening, pauseListening, stopListening, caption, connectionReady } = useSpeechToText();
  const [isRecording, setIsRecording] = useState(false);

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
  };

  const handlePauseListening = () => {
    pauseListening();
    setIsRecording(false);
  };

  useEffect(() => {
    onCaption(caption[id]);
  }, [caption[id]]);

  return (
    <div>
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
