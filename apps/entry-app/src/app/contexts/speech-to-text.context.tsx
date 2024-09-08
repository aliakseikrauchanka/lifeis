import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useMicrophone, MicrophoneState, MicrophoneEvents } from './microphone.context';
import { useDeepgram, LiveConnectionState, LiveTranscriptionEvents, LiveTranscriptionEvent } from './deepgram.context';
import { LiveClient } from '@deepgram/sdk';

interface SpeechToTextContextType {
  caption: { [activeId: string]: string };
  startListening: (id: string) => void;
  stopListening: () => void;
}

const SpeechToTextContext = createContext<SpeechToTextContextType | undefined>(undefined);

interface SpeechToTextContextProviderProps {
  children: ReactNode;
}

const SpeechToTextContextProvider: React.FC<SpeechToTextContextProviderProps> = ({ children }) => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState({});
  const { connection, connectToDeepgram, connectionState } = useDeepgram();
  const { setupMicrophone, microphone, startMicrophone, microphoneState, stopMicrophone } = useMicrophone();
  const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();

  useEffect(() => {
    setupMicrophone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (microphoneState === MicrophoneState.Ready) {
      connectToDeepgram({
        model: 'nova-2',
        interim_results: true,
        smart_format: true,
        filler_words: true,
        utterance_end_ms: 5000,
        language: 'ru-RU',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState]);

  useEffect(() => {
    if (!microphone) return;
    if (!connection) return;

    const onData = (e: BlobEvent) => {
      // iOS SAFARI FIX:
      // Prevent packetZero from being sent. If sent at size 0, the connection will close.
      if (e.data.size > 0) {
        connection?.send(e.data);
      }
    };

    const onTranscript = (data: LiveTranscriptionEvent) => {
      const { is_final: isFinal, speech_final: speechFinal } = data;
      const thisCaption = data.channel.alternatives[0].transcript;

      console.log('thisCaption', thisCaption);
      if (thisCaption) {
        setCaption((prevCaption) => {
          if (activeId === undefined) {
            return prevCaption;
          }
          return {
            ...prevCaption,
            [activeId]: thisCaption,
          };
        });
      }

      if (isFinal && speechFinal) {
        clearTimeout(captionTimeout.current);
        captionTimeout.current = setTimeout(() => {
          // setCaption((prevCaption) => {
          //   if (activeId === undefined) {
          //     return prevCaption;
          //   }
          //   return {
          //     ...prevCaption,
          //     [activeId]: undefined,
          //   };
          // });
          // setActiveId(undefined);
          clearTimeout(captionTimeout.current);
        }, 3000);
      }
    };

    if (connectionState === LiveConnectionState.OPEN) {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.addEventListener(MicrophoneEvents.DataAvailable, onData);

      // startMicrophone();
    }

    return () => {
      // prettier-ignore
      connection.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
      microphone.removeEventListener(MicrophoneEvents.DataAvailable, onData);
      clearTimeout(captionTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, activeId]);

  useEffect(() => {
    if (!connection) return;

    if (microphoneState !== MicrophoneState.Open && connectionState === LiveConnectionState.OPEN) {
      connection.keepAlive();

      keepAliveInterval.current = setInterval(() => {
        connection.keepAlive();
      }, 10000);
    } else {
      clearInterval(keepAliveInterval.current);
    }

    return () => {
      clearInterval(keepAliveInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, connectionState]);

  const startListening = useCallback(
    (id: string) => {
      setActiveId(id);
      startMicrophone();
    },
    [startMicrophone],
  );

  const stopListening = useCallback(() => {
    setActiveId(undefined);
    stopMicrophone();
  }, [stopMicrophone]);

  return (
    <SpeechToTextContext.Provider
      value={{
        caption,
        startListening,
        stopListening,
      }}
    >
      {children}
    </SpeechToTextContext.Provider>
  );
};

function useSpeechToText(): SpeechToTextContextType {
  const context = useContext(SpeechToTextContext);
  if (context === undefined) {
    throw new Error('useSpeechToText must be used within a SpeechToTextContextProvider');
  }
  return context;
}

export { SpeechToTextContextProvider, useSpeechToText };
