'use client';

import { useSpeechToText } from '../../contexts/speech-to-text.context';
import { OwnButton } from '../button/button';
import { useEffect, useState } from 'react';

interface ISpeechToTextProps {
  id: string;
  onCaption: (caption: string[] | undefined) => void;
}

export const SpeechToText = ({ id, onCaption }: ISpeechToTextProps) => {
  const { startListening, stopListening, caption } = useSpeechToText();
  const [isRecording, setIsRecording] = useState(false);

  const handleStartListening = () => {
    startListening(id);
    setIsRecording(true);
  };

  const handleStopListening = () => {
    stopListening();
    setIsRecording(false);
  };

  useEffect(() => {
    onCaption(caption[id]);
  }, [caption[id]]);

  return (
    <div>
      <OwnButton type="button" color="success" onClick={handleStartListening} disabled={isRecording}>
        Record
      </OwnButton>

      <OwnButton type="button" color="success" onClick={handleStopListening} disabled={!isRecording}>
        Pause
      </OwnButton>
    </div>
  );
};
