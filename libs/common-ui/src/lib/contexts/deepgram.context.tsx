'use client';

import {
  CreateProjectKeyResponse,
  LiveClient,
  LiveSchema,
  LiveTranscriptionEvents,
  SpeakSchema,
  createClient,
} from '@deepgram/sdk';
import { utilFetch } from '../utils/util-fetch';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
// import { useLocalStorage } from '../lib/hooks/useLocalStorage';

type DeepgramContext = {
  // ttsOptions: SpeakSchema | undefined;
  // setTtsOptions: (value: SpeakSchema) => void;
  sttOptions: LiveSchema | undefined;
  // setSttOptions: (value: LiveSchema) => void;
  // setLanguage: (language: string) => void;
  connection: LiveClient | undefined;
  onResetDone: () => void;
  isNeedReset: boolean;
  connectionReady: boolean;
};
interface DeepgramContextInterface {
  language?: string;
  children: React.ReactNode;
}

const DeepgramContext = createContext({} as DeepgramContext);

const DEFAULT_STT_MODEL = 'nova-2';

const DEFAULT_LANGUAGE = 'ru-RU';

const defaultSttsOptions: SpeakSchema = {
  model: DEFAULT_STT_MODEL,
  // interim_results: true,
  smart_format: true,
  // endpointing: 550,
  // utterance_end_ms: 1500,
  // filler_words: true,
  language: DEFAULT_LANGUAGE,
};

const getApiKey = async (): Promise<string> => {
  const response = await utilFetch(`/deepgram/authenticate`, { cache: 'no-store' });
  const result: CreateProjectKeyResponse = await response.json();
  return result.key;
};

const DeepgramContextProvider = ({ language = DEFAULT_LANGUAGE, children }: DeepgramContextInterface) => {
  // const [ttsOptions, setTtsOptions] = useLocalStorage<SpeakSchema | undefined>('ttsModel');
  const [isNeedReset, setIsNeedReset] = useState(false);
  const [sttOptions, setSttOptions] = useState<LiveSchema>({ ...defaultSttsOptions, language });
  // const [language, setLanguage] = useState<string>(defaultLanguage);
  const [connection, setConnection] = useState<LiveClient>();
  // const [connecting, setConnecting] = useState<boolean>(false);
  const [connectionReady, setConnectionReady] = useState<boolean>(false);
  const connectingRef = useRef(false);

  const connect = useCallback(
    async (sttOptions: LiveSchema) => {
      if (!connectingRef.current) {
        connectingRef.current = true;

        const apiKey = await getApiKey();
        const deepgram = createClient(apiKey);

        const connection = deepgram.listen.live({ ...sttOptions });

        setConnection(connection);
        connectingRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [setConnection],
  );

  useEffect(() => {
    if (language === sttOptions.language) {
      return;
    }

    setSttOptions({ ...defaultSttsOptions, language });
  }, [language, sttOptions, setSttOptions]);

  useEffect(() => {
    // it must be the first open of the page, let's set up the defaults

    // Why this is needed?, the requestTtsAudio of Conversation is wrapped in useCallback
    // which has a dependency of ttsOptions model
    // but the player inside the Nowplaying provider is set on mount, means
    // the when the startAudio is called the player is undefined.

    // This can be fixed in 3 ways:
    // 1. set player as a dependency inside the useCallback of requestTtsAudio
    // 2. change the code of react-nowplaying to use the ref mechanism
    // 3. follow the old code to avoid any risk i.e., first ttsOptions is undefined
    // and later when it gets set, it also update the requestTtsAudio callback.
    // if (ttsOptions === undefined) {
    // setTtsOptions(defaultTtsOptions);
    // }

    // if (sttOptions === undefined) {
    //   setSttOptions(defaultSttsOptions);
    // }
    // if (connection === undefined) {
    // console.log('debug, connecting to deepgram');
    connect(sttOptions);
    // }
  }, [connect, setSttOptions, sttOptions]);

  useEffect(() => {
    if (connection && connection?.getReadyState() !== undefined) {
      connection.addListener(LiveTranscriptionEvents.Open, () => {
        console.log('debug, the connection to Deepgram opened.');
        setConnectionReady(true);
        setIsNeedReset(true);
      });

      connection.addListener(LiveTranscriptionEvents.Close, () => {
        setConnectionReady(false);
        connection.removeAllListeners();
        setConnection(undefined);
      });

      connection.addListener(LiveTranscriptionEvents.Error, () => {
        setConnectionReady(false);
        connection.removeAllListeners();
        setConnection(undefined);
      });
    }

    return () => {
      setConnectionReady(false);
      connection?.removeAllListeners();
      connection?.requestClose();
    };
  }, [connection]);

  return (
    <DeepgramContext.Provider
      value={{
        // ttsOptions,
        // setTtsOptions,
        sttOptions,
        // setSttOptions,
        // setLanguage,
        connection,
        connectionReady,
        isNeedReset,
        onResetDone: () => {
          setIsNeedReset(false);
        },
      }}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram() {
  return useContext(DeepgramContext);
}

export { DeepgramContextProvider, useDeepgram };
