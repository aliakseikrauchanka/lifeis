'use client';

import { useEffect } from 'react';
import { useSpeechToText } from '../../contexts/speech-to-text.context';

interface ISpeechToTextProps {
  id: string;
  onCaption: (caption: string) => void;
}

export const SpeechToText = ({ id, onCaption }: ISpeechToTextProps) => {
  const { startListening, stopListening, caption } = useSpeechToText();

  useEffect(() => {
    onCaption(caption[id]);
  }, [caption[id]]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          startListening(id);
        }}
      >
        Record
      </button>
      <button
        type="button"
        onClick={() => {
          stopListening();
        }}
      >
        Pause
      </button>
    </div>
  );
};
