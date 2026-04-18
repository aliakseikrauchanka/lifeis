'use client';

import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';
import { utilFetch } from '../utils/util-fetch';
import { SpeechToTextContext } from './speech-to-text.context';

interface DeepgramFileSTTProviderProps {
  language?: string;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;
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

const DeepgramFileSTTProvider: React.FC<DeepgramFileSTTProviderProps> = ({
  language,
  audioInputDeviceId,
  audioOutputDeviceId,
  children,
}) => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState<{ [activeId: string]: string[] }>({});
  const [recordedBlobs, setRecordedBlobs] = useState<{ [id: string]: Blob[] }>({});
  const activeIdRef = useRef<string | undefined>(undefined);
  const cancelledRef = useRef(false);

  const startRecording = useCallback(
    (onStop: (blob: Blob) => void) => {
      const getStream = async () => {
        if (audioInputDeviceId) {
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: audioInputDeviceId } },
            });
          } catch (err) {
            if ((err as DOMException)?.name === 'OverconstrainedError') {
              console.warn(
                '[DG File STT] Selected microphone is unavailable, falling back to default',
              );
              return navigator.mediaDevices.getUserMedia({ audio: true });
            }
            throw err;
          }
        }
        return navigator.mediaDevices.getUserMedia({ audio: true });
      };

      getStream()
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
            mediaRecorderRef = null;
            onStop(blob);
            stream.getTracks().forEach((track) => track.stop());
          };

          mediaRecorder.start(250);
        })
        .catch((err) => {
          console.error('Error while recording:', err);
        });
    },
    [audioInputDeviceId],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef && mediaRecorderRef.state !== 'inactive') {
      mediaRecorderRef.stop();
    }
  }, []);

  const startListening = useCallback(
    (id: string) => {
      cancelledRef.current = false;
      activeIdRef.current = id;
      setActiveId(id);
      setRecordedBlobs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      startRecording(async (blob: Blob) => {
        const idForCaption = activeIdRef.current;
        if (!idForCaption || cancelledRef.current) return;

        console.log('[DG File STT] Recorded blob', { size: blob.size, type: blob.type });
        if (blob.size === 0) {
          console.warn('[DG File STT] Skipping empty blob');
          setActiveId(undefined);
          activeIdRef.current = undefined;
          return;
        }

        // Store latest blob only (overwrites previous take for this id)
        setRecordedBlobs((prev) => ({
          ...prev,
          [idForCaption]: [blob],
        }));

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
      setRecordedBlobs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
        recordedBlobs,
        startListening,
        stopListening,
        pauseListening,
        audioOutputDeviceId,
      }}
    >
      {children}
    </SpeechToTextContext.Provider>
  );
};

export { DeepgramFileSTTProvider };
