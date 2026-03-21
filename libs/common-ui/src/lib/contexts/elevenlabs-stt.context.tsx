'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';

import { utilFetch } from '../utils/util-fetch';
import { SpeechToTextContext } from './speech-to-text.context';

interface ElevenLabsSTTProviderProps {
  language?: string;
  audioInputDeviceId?: string;
  children: ReactNode;
}

async function getToken(): Promise<string> {
  const response = await utilFetch('/elevenlabs/stt-token', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.token) {
    throw new Error('Token response missing token field');
  }
  return result.token;
}

const ElevenLabsSTTProvider: React.FC<ElevenLabsSTTProviderProps> = ({
  language = 'en',
  audioInputDeviceId,
  children,
}) => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState<{ [activeId: string]: string[] }>({});

  const activeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    languageCode: language,
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: (data) => {
      const currentActiveId = activeIdRef.current;
      if (data.text && currentActiveId) {
        setCaption((prev) => ({
          ...prev,
          [currentActiveId]: [...(prev[currentActiveId] || []), data.text],
        }));
      }
    },
    onError: (error) => {
      console.error('[EL-STT] Error:', error);
    },
  });

  const isActive = scribe.status === 'connected' || scribe.status === 'transcribing';
  const connectionReady = scribe.status !== 'connecting';

  const startListening = useCallback(
    async (id: string) => {
      if (activeIdRef.current === id && isActive) return;

      if (isActive) {
        scribe.disconnect();
      }
      setActiveId(id);

      try {
        let deviceId = audioInputDeviceId;
        if (!deviceId) {
          const probeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          deviceId = probeStream.getAudioTracks()[0].getSettings().deviceId;
          probeStream.getTracks().forEach((t) => t.stop());
        }

        const token = await getToken();
        await scribe.connect({
          token,
          microphone: {
            deviceId,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.error('[EL-STT] Failed to start:', err);
        scribe.disconnect();
      }
    },
    [scribe, isActive, audioInputDeviceId],
  );

  const stopListening = useCallback(
    (id: string) => {
      setActiveId(undefined);
      setCaption((prev) => ({
        ...prev,
        [id]: [],
      }));
      scribe.disconnect();
    },
    [scribe],
  );

  const pauseListening = useCallback(() => {
    setActiveId(undefined);
    scribe.disconnect();
  }, [scribe]);

  return (
    <SpeechToTextContext.Provider
      value={{
        connectionReady,
        caption,
        recordedBlobs: {},
        startListening,
        stopListening,
        pauseListening,
      }}
    >
      {children}
    </SpeechToTextContext.Provider>
  );
};

export { ElevenLabsSTTProvider };
