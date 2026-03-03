'use client';

import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { utilFetch } from '../utils/util-fetch';
import { SpeechToTextContext } from './speech-to-text.context';

interface DeepgramFileSTTProviderProps {
  language?: string;
  children: ReactNode;
}

let mediaRecorderRef: MediaRecorder | null = null;
const chunksRef: Array<Blob> = [];

async function transcribeBlob(blob: Blob, language?: string): Promise<string> {
  const formData = new FormData();
  formData.append('audio', blob);

  const url = language ? `/deepgram/transcribe?language=${encodeURIComponent(language)}` : '/deepgram/transcribe';

  const response = await utilFetch(url, {
    method: 'POST',
    body: formData,
    headers: { MIME: blob.type },
  });

  const data = await response.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
}

const DeepgramFileSTTProvider: React.FC<DeepgramFileSTTProviderProps> = ({ language, children }) => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState<{ [activeId: string]: string[] }>({});
  const activeIdRef = useRef<string | undefined>(undefined);
  const cancelledRef = useRef(false);

  const startRecording = useCallback((onStop: (blob: Blob) => void) => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        let options: MediaRecorderOptions | undefined;
        if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
          options = { mimeType: 'audio/webm; codecs=opus' };
        } else {
          options = { mimeType: 'video/mp4', videoBitsPerSecond: 100000 };
        }
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef = mediaRecorder;
        chunksRef.length = 0;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef, { type: options?.mimeType });
          chunksRef.length = 0;
          onStop(blob);
        };

        mediaRecorder.start();
      })
      .catch((err) => {
        console.error('Error while recording:', err);
      });
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef?.state === 'recording') {
      mediaRecorderRef.pause();
      mediaRecorderRef.stop();
    }
  }, []);

  const startListening = useCallback(
    (id: string) => {
      cancelledRef.current = false;
      activeIdRef.current = id;
      setActiveId(id);

      startRecording(async (blob: Blob) => {
        const idForCaption = activeIdRef.current;
        if (!idForCaption || cancelledRef.current) return;

        try {
          const transcript = await transcribeBlob(blob, language);
          if (transcript && !cancelledRef.current) {
            setCaption((prev) => ({
              ...prev,
              [idForCaption]: [...(prev[idForCaption] || []), transcript],
            }));
          }
        } catch (err) {
          console.error('[DG File STT] Transcription failed:', err);
        } finally {
          setActiveId(undefined);
          activeIdRef.current = undefined;
        }
      });
    },
    [startRecording, language],
  );

  const stopListening = useCallback(
    (id: string) => {
      cancelledRef.current = true;
      setCaption((prev) => ({ ...prev, [id]: [] }));
      stopRecording();
    },
    [stopRecording],
  );

  const pauseListening = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  return (
    <SpeechToTextContext.Provider
      value={{
        connectionReady: true,
        caption,
        startListening,
        stopListening,
        pauseListening,
      }}
    >
      {children}
    </SpeechToTextContext.Provider>
  );
};

export { DeepgramFileSTTProvider };
