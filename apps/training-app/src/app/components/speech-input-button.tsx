import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Play, Square } from 'lucide-react';
import { useSpeechToText } from '@lifeis/common-ui';
import { Button } from './ui/button';

interface SpeechInputButtonProps {
  id: string;
  onAppend: (chunk: string) => void;
  disabled?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  active?: boolean;
  shortcutEnabled?: boolean;
}

export function SpeechInputButton({
  id,
  onAppend,
  disabled,
  onStart,
  onStop,
  active = true,
  shortcutEnabled = true,
}: SpeechInputButtonProps) {
  const {
    startListening,
    pauseListening,
    caption,
    recordedBlobs,
    connectionReady,
    audioOutputDeviceId,
  } = useSpeechToText();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const processedTranscriptRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleStart = useCallback(() => {
    processedTranscriptRef.current = null;
    startListening(id);
    setIsRecording(true);
    onStart?.();
  }, [id, startListening, onStart]);

  const handleStop = useCallback(() => {
    pauseListening();
    setIsRecording(false);
    onStop?.();
  }, [pauseListening, onStop]);

  useEffect(() => {
    if (!active && !isRecording) return;
    const parts = caption[id];
    if (!parts?.length) {
      // Caption was cleared externally (e.g. user cleared the input).
      // Forget last processed transcript so a re-recording with identical text
      // is still appended.
      processedTranscriptRef.current = null;
      return;
    }
    const text = parts.join(' ').trim();
    if (!text || processedTranscriptRef.current === text) return;
    processedTranscriptRef.current = text;
    onAppend(text);
  }, [active, isRecording, caption, id, onAppend]);

  const latestBlob = recordedBlobs[id]?.[0];
  const hasRecording = !!latestBlob;

  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }
    if (!latestBlob) return;
    const url = URL.createObjectURL(latestBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlaying(true);
    const cleanup = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      setIsPlaying(false);
    };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    const audioAny = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (audioOutputDeviceId && typeof audioAny.setSinkId === 'function') {
      try {
        await audioAny.setSinkId(audioOutputDeviceId);
      } catch {
        // fall back to default if selected sink unavailable
      }
    }
    audio.play().catch(cleanup);
  }, [isPlaying, latestBlob, audioOutputDeviceId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!shortcutEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
      if (!isToggle) return;
      e.preventDefault();
      if (isRecording) {
        handleStop();
      } else if (connectionReady && !disabled) {
        handleStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutEnabled, isRecording, connectionReady, disabled, handleStart, handleStop]);

  return (
    <>
      {isRecording ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleStop}
          className="shrink-0 px-2"
          title="Stop recording"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStart}
          disabled={!connectionReady || disabled}
          className="shrink-0 px-2"
          title="Record"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      {hasRecording && !isRecording && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlay}
          disabled={disabled}
          className="shrink-0 px-2"
          title={isPlaying ? 'Stop playback' : 'Play recording'}
        >
          {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      )}
    </>
  );
}
