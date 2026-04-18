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
}

export function SpeechInputButton({
  id,
  onAppend,
  disabled,
  onStart,
  onStop,
  active = true,
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
    if (!parts?.length) return;
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

  return (
    <>
      {isRecording ? (
        <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1">
          <Square className="h-4 w-4" /> Stop
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStart}
          disabled={!connectionReady || disabled}
          className="gap-1"
        >
          <Mic className="h-4 w-4" /> Record
        </Button>
      )}
      {hasRecording && !isRecording && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlay}
          disabled={disabled}
          className="gap-1"
          title={isPlaying ? 'Stop playback' : 'Play recording'}
        >
          {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? 'Stop' : 'Play'}
        </Button>
      )}
    </>
  );
}
