import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useMicrophone, MicrophoneState, MicrophoneEvents } from './microphone.context';
import { useDeepgram } from './deepgram.context';
import { useQueue } from '@uidotdev/usehooks';
import { LiveClient, LiveTranscriptionEvent, LiveTranscriptionEvents } from '@deepgram/sdk';
import { useMicVAD } from '../hooks/use-mic-vad';

interface SpeechToTextContextType {
  caption: { [activeId: string]: string[] };
  startListening: (id: string) => void;
  stopListening: () => void;
}

const utteranceText = (event: LiveTranscriptionEvent) => {
  const words = event.channel.alternatives[0].words;
  return words.map((word: any) => word.punctuated_word ?? word.word).join(' ');
};

const SpeechToTextContext = createContext<SpeechToTextContextType | undefined>(undefined);

interface SpeechToTextContextProviderProps {
  children: ReactNode;
}

const SpeechToTextContextProvider: React.FC<SpeechToTextContextProviderProps> = ({ children }) => {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState<{ [activeId: string]: string[] }>({});

  const { connection, connectionReady } = useDeepgram();
  const {
    add: addTranscriptPart,
    queue: transcriptParts,
    clear: clearTranscriptParts,
  } = useQueue<{ is_final: boolean; speech_final: boolean; text: string }>([]);

  const [isProcessing, setProcessing] = useState(false);

  const {
    microphoneState,
    queue: microphoneQueue,
    queueSize: microphoneQueueSize,
    firstBlob,
    removeBlob,
    startMicrophone,
    stopMicrophone,
    stream,
  } = useMicrophone();
  // const captionTimeout = useRef<any>();
  const keepAliveInterval = useRef<any>();

  const [currentUtterance, setCurrentUtterance] = useState<string>();
  const [failsafeTimeout, setFailsafeTimeout] = useState<NodeJS.Timeout>();
  const [failsafeTriggered, setFailsafeTriggered] = useState<boolean>(false);

  const onSpeechEnd = useCallback(() => {
    /**
     * We have the audio data context available in VAD
     * even before we start sending it to deepgram.
     * So ignore any VAD events before we "open" the mic.
     */
    if (microphoneState !== MicrophoneState.Open) return;

    setFailsafeTimeout(
      setTimeout(() => {
        if (currentUtterance) {
          console.log('failsafe fires! pew pew!!');
          setFailsafeTriggered(true);
          setCaption((prevCaption) => {
            if (activeId === undefined) {
              return prevCaption;
            }
            return {
              ...prevCaption,
              [activeId]: [...(prevCaption[activeId] || []), currentUtterance],
            };
          });
          clearTranscriptParts();
          setCurrentUtterance(undefined);
        }
      }, 1500),
    );

    return () => {
      clearTimeout(failsafeTimeout);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microphoneState, currentUtterance]);

  const onSpeechStart = () => {
    /**
     * We have the audio data context available in VAD
     * even before we start sending it to deepgram.
     * So ignore any VAD events before we "open" the mic.
     */
    if (microphoneState !== MicrophoneState.Open) return;

    /**
     * We we're talking again, we want to wait for a transcript.
     */

    console.log('speech start!');
    setFailsafeTriggered(false);
  };

  useMicVAD({
    startOnLoad: true,
    stream,
    onSpeechStart,
    onSpeechEnd,
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.5 - 0.15,
  });

  useEffect(() => {
    const onTranscript = (data: LiveTranscriptionEvent) => {
      const content = utteranceText(data);

      // i only want an empty transcript part if it is speech_final
      if (content !== '' || data.speech_final) {
        /**
         * use an outbound message queue to build up the unsent utterance
         */
        addTranscriptPart({
          is_final: data.is_final as boolean,
          speech_final: data.speech_final as boolean,
          text: content,
        });
      }
    };

    const onOpen = (connection: LiveClient) => {
      connection.addListener(LiveTranscriptionEvents.Transcript, onTranscript);
    };

    if (connection) {
      connection.addListener(LiveTranscriptionEvents.Open, onOpen);
    }

    return () => {
      connection?.removeListener(LiveTranscriptionEvents.Open, onOpen);
      connection?.removeListener(LiveTranscriptionEvents.Transcript, onTranscript);
    };
  }, [addTranscriptPart, connection]);

  const getCurrentUtterance = useCallback(() => {
    return transcriptParts.filter(({ is_final, speech_final }, i, arr) => {
      return is_final || speech_final || (!is_final && i === arr.length - 1);
    });
  }, [transcriptParts]);

  useEffect(() => {
    const parts = getCurrentUtterance();
    const last = parts[parts.length - 1];
    const content = parts
      .map(({ text }) => text)
      .join(' ')
      .trim();

    /**
     * if the entire utterance is empty, don't go any further
     * for example, many many many empty transcription responses
     */
    if (!content) return;

    /**
     * failsafe was triggered since we last sent a message to TTS
     */
    if (failsafeTriggered) {
      clearTranscriptParts();
      setCurrentUtterance(undefined);
      return;
    }

    /**
     * display the concatenated utterances
     */
    setCurrentUtterance(content);

    /**
     * if the last part of the utterance, empty or not, is speech_final, send to the LLM.
     */
    if (last && last.speech_final) {
      clearTimeout(failsafeTimeout);
      setCaption((prevCaption) => {
        if (activeId === undefined) {
          return prevCaption;
        }
        return {
          ...prevCaption,
          [activeId]: [...(prevCaption[activeId] || []), content],
        };
      });

      clearTranscriptParts();
      setCurrentUtterance(undefined);
    }
  }, [getCurrentUtterance, clearTranscriptParts, failsafeTimeout, failsafeTriggered, activeId, setCaption]);

  /**
   * magic microphone audio queue processing
   */
  useEffect(() => {
    const processQueue = async () => {
      if (microphoneQueueSize > 0 && !isProcessing) {
        setProcessing(true);

        if (connectionReady) {
          const nextBlob = firstBlob;

          if (nextBlob && nextBlob?.size > 0) {
            connection?.send(nextBlob);
          }

          removeBlob();
        }

        const waiting = setTimeout(() => {
          clearTimeout(waiting);
          setProcessing(false);
        }, 200);
      }
    };

    processQueue();
  }, [connection, microphoneQueue, removeBlob, firstBlob, microphoneQueueSize, isProcessing, connectionReady]);

  useEffect(() => {
    if (!connection) return;

    if (microphoneState !== MicrophoneState.Open && connectionReady) {
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
  }, [microphoneState, connectionReady]);

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
