'use client';

import { createContext, useCallback, useContext, useState, ReactNode, useEffect } from 'react';
import { useQueue } from '@uidotdev/usehooks';

interface MicrophoneContextType {
  microphone: MediaRecorder | null;
  stream: MediaStream | undefined;
  startMicrophone: () => void;
  pauseMicrophone: () => void;
  microphoneState: MicrophoneState | null;
  enqueueBlob: (element: Blob) => void;
  removeBlob: () => Blob | undefined;
  clearBlobs: () => void;
  resetMicrophone: () => void;
  firstBlob: Blob | undefined;
  queueSize: number;
  queue: Blob[];
}

export enum MicrophoneEvents {
  DataAvailable = 'dataavailable',
  Error = 'error',
  Pause = 'pause',
  Resume = 'resume',
  Start = 'start',
  Stop = 'stop',
}

export enum MicrophoneState {
  NotSetup = -1,
  SettingUp = 0,
  Ready = 1,
  Opening = 2,
  Open = 3,
  Error = 4,
  Pausing = 5,
  Paused = 6,
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(undefined);

interface MicrophoneContextProviderProps {
  children: ReactNode;
}

const MicrophoneContextProvider: React.FC<MicrophoneContextProviderProps> = ({ children }) => {
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(MicrophoneState.NotSetup);
  const [microphone, setMicrophone] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream>();

  const {
    add: enqueueBlob, // addMicrophoneBlob,
    remove: removeBlob, // removeMicrophoneBlob,
    first: firstBlob, // firstMicrophoneBlob,
    size: queueSize, // countBlobs,
    queue, // : microphoneBlobs,
    clear: clearBlobs, // clearMicrophoneBlobs,
  } = useQueue<Blob>([]);

  const setupMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        noiseSuppression: true,
        echoCancellation: true,
      });
      setStream(stream);
      const microphone = new MediaRecorder(stream);
      setMicrophone(microphone);
    } catch (error) {
      setMicrophoneState(MicrophoneState.Error);
      console.error('Error setting up microphone:', error);
      throw new Error('ololo');
    }
  }, []);

  const resetMicrophone = useCallback(() => {
    setMicrophoneState(MicrophoneState.NotSetup);
    setMicrophone(null);
    setStream(undefined);
    clearBlobs();
    setupMicrophone();
  }, [clearBlobs, setupMicrophone]);

  useEffect(() => {
    if (!microphone) {
      setupMicrophone();
    }
  }, [microphone, setupMicrophone]);

  const pauseMicrophone = useCallback(() => {
    setMicrophoneState(MicrophoneState.Pausing);

    if (microphone?.state === 'recording') {
      microphone.pause();
      setMicrophoneState(MicrophoneState.Paused);
    }
  }, [microphone]);

  const startMicrophone = useCallback(() => {
    setMicrophoneState(MicrophoneState.Opening);

    if (microphone?.state === 'paused') {
      microphone.resume();
    } else {
      microphone?.start(250);
    }

    setMicrophoneState(MicrophoneState.Open);
  }, [microphone]);

  useEffect(() => {
    if (!microphone) return;

    microphone.ondataavailable = (e) => {
      if (microphoneState === MicrophoneState.Open) enqueueBlob(e.data);
    };

    return () => {
      microphone.ondataavailable = null;
    };
  }, [enqueueBlob, microphone, microphoneState]);

  // useEffect(() => {
  //   const eventer = () => document.visibilityState !== 'visible' && stopMicrophone();

  //   window.addEventListener('visibilitychange', eventer);

  //   return () => {
  //     window.removeEventListener('visibilitychange', eventer);
  //   };
  // }, [stopMicrophone]);

  return (
    <MicrophoneContext.Provider
      value={{
        microphone,
        resetMicrophone,
        startMicrophone,
        pauseMicrophone,
        microphoneState,
        stream,
        enqueueBlob,
        removeBlob,
        firstBlob,
        queueSize,
        queue,
        clearBlobs,
      }}
    >
      {children}
    </MicrophoneContext.Provider>
  );
};

function useMicrophone(): MicrophoneContextType {
  const context = useContext(MicrophoneContext);

  if (context === undefined) {
    throw new Error('useMicrophone must be used within a MicrophoneContextProvider');
  }

  return context;
}

export { MicrophoneContextProvider, useMicrophone };
