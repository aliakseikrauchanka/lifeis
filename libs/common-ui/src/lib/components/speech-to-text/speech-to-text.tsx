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
  onHasRecording?: (hasRecording: boolean) => void;
  showPlayButton?: boolean;
}

export const SpeechToText = ({
  id,
  className,
  isNeedClear,
  isToggledListening,
  onCaption,
  onCleared,
  onListeningToggled,
  onHasRecording,
  showPlayButton = true,
}: ISpeechToTextProps) => {
  const { startListening, pauseListening, stopListening, caption, recordedBlobs, connectionReady } = useSpeechToText();
  const [isRecording, setIsRecording] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isNeedClear) {
      onCleared?.();
      onHasRecording?.(false);
      setIsRecording(false);
      stopListening(id);
    }
  }, [isNeedClear, onCleared, onHasRecording, stopListening, id]);

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

  const handlePlayRecording = useCallback(() => {
    const blobs = recordedBlobs[id];
    if (!blobs?.length) return;
    const combined = new Blob([blobs[blobs.length - 1]], { type: blobs[0]?.type || 'audio/webm' });
    const url = URL.createObjectURL(combined);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => URL.revokeObjectURL(url));
  }, [recordedBlobs, id]);

  const hasPlayback = !!(recordedBlobs[id]?.length || caption[id]?.length);

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

  const hasRecordingBlobs = !!recordedBlobs[id]?.length;
  useEffect(() => {
    onHasRecording?.(hasRecordingBlobs);
  }, [hasRecordingBlobs, onHasRecording]);

  return (
    <div className={className}>
      <OwnButton
        type="button"
        color="success"
        onClick={handleStartListening}
        disabled={!connectionReady || isRecording}
      >
        Record
      </OwnButton>

      <OwnButton type="button" color="success" onClick={handlePauseListening} disabled={!isRecording}>
        Pause
      </OwnButton>

      {showPlayButton && (
        <OwnButton type="button" color="success" onClick={handlePlayRecording} disabled={!hasPlayback}>
          Play
        </OwnButton>
      )}
    </div>
  );
};
