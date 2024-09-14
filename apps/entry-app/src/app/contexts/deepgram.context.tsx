'use client';

import {
  CreateProjectKeyResponse,
  LiveClient,
  LiveSchema,
  LiveTranscriptionEvents,
  SpeakSchema,
  createClient,
} from '@deepgram/sdk';
import { Dispatch, SetStateAction, createContext, useCallback, useContext, useEffect, useState } from 'react';
// import { useToast } from './Toast';
// import { useLocalStorage } from '../lib/hooks/useLocalStorage';

import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../config';

type DeepgramContext = {
  // ttsOptions: SpeakSchema | undefined;
  // setTtsOptions: (value: SpeakSchema) => void;
  sttOptions: LiveSchema | undefined;
  setSttOptions: (value: LiveSchema) => void;
  connection: LiveClient | undefined;
  connectionReady: boolean;
};

interface DeepgramContextInterface {
  children: React.ReactNode;
}

const DeepgramContext = createContext({} as DeepgramContext);

const DEFAULT_STT_MODEL = 'nova-2';

const defaultSttsOptions: SpeakSchema = {
  model: DEFAULT_STT_MODEL,
  interim_results: true,
  smart_format: true,
  endpointing: 550,
  utterance_end_ms: 1500,
  filler_words: true,
  language: 'ru-RU',
};

const getApiKey = async (): Promise<string> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/deepgram/authenticate`, { cache: 'no-store' });
  const result: CreateProjectKeyResponse = await response.json();
  return result.key;
};

const DeepgramContextProvider = ({ children }: DeepgramContextInterface) => {
  // const [ttsOptions, setTtsOptions] = useLocalStorage<SpeakSchema | undefined>('ttsModel');
  const [sttOptions, setSttOptions] = useState<LiveSchema | undefined>();
  const [connection, setConnection] = useState<LiveClient>();
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectionReady, setConnectionReady] = useState<boolean>(false);

  const connect = useCallback(
    async (defaultSttsOptions: SpeakSchema) => {
      if (!connection && !connecting) {
        setConnecting(true);

        const deepgram = createClient(await getApiKey());

        const connection = deepgram.listen.live(defaultSttsOptions);

        setConnection(connection);
        setConnecting(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [connecting, connection],
  );

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

    if (!sttOptions === undefined) {
      setSttOptions(defaultSttsOptions);
    }
    if (connection === undefined) {
      connect(defaultSttsOptions);
    }
  }, [connect, connection, setSttOptions, sttOptions]);

  useEffect(() => {
    if (connection && connection?.getReadyState() !== undefined) {
      connection.addListener(LiveTranscriptionEvents.Open, () => {
        setConnectionReady(true);
      });

      connection.addListener(LiveTranscriptionEvents.Close, () => {
        console.log("The connection to Deepgram closed, we'll attempt to reconnect.");
        setConnectionReady(false);
        connection.removeAllListeners();
        setConnection(undefined);
      });

      connection.addListener(LiveTranscriptionEvents.Error, () => {
        console.log("An unknown error occured. We'll attempt to reconnect to Deepgram.");
        setConnectionReady(false);
        connection.removeAllListeners();
        setConnection(undefined);
      });
    }

    return () => {
      setConnectionReady(false);
      connection?.removeAllListeners();
    };
  }, [connection]);

  return (
    <DeepgramContext.Provider
      value={{
        // ttsOptions,
        // setTtsOptions,
        sttOptions,
        setSttOptions,
        connection,
        connectionReady,
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
