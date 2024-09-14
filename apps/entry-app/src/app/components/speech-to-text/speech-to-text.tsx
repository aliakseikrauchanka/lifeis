'use client';

import { useEffect } from 'react';
import { useSpeechToText } from '../../contexts/speech-to-text.context';
import { OwnButton } from '@lifeis/common-ui';

interface ISpeechToTextProps {
  id: string;
  onCaption: (caption: string[] | undefined) => void;
}

export const SpeechToText = ({ id, onCaption }: ISpeechToTextProps) => {
  const { startListening, stopListening, caption } = useSpeechToText();

  useEffect(() => {
    onCaption(caption[id]);
  }, [caption[id]]);

  return (
    <div>
      <OwnButton type="button" color="success" onClick={() => startListening(id)}>
        Record
      </OwnButton>

      <OwnButton type="button" color="success" onClick={() => stopListening()}>
        Pause
      </OwnButton>
    </div>
  );
};
