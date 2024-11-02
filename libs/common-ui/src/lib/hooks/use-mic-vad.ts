import { MicVAD as MicVADType } from '@ricky0123/vad-web';
import React, { useEffect, useReducer, useState } from 'react';
import { ReactRealTimeVADOptions, useMicVADConfig } from './use-mic-vad-config';

function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref: any = React.useRef(fn);

  // we copy a ref to the callback scoped to the current state/props on each render
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });

  return React.useCallback((...args: any[]) => ref.current.apply(void 0, args), []) as T;
}

export function useMicVAD(options: Partial<ReactRealTimeVADOptions>) {
  const { useOptions } = useMicVADConfig();

  const [reactOptions, vadOptions] = useOptions(options);
  const [userSpeaking, updateUserSpeaking] = useReducer((state: boolean, isSpeechProbability: number) => {
    // console.log('isSpeechProbability', isSpeechProbability);
    return isSpeechProbability > reactOptions.userSpeakingThreshold;
  }, false);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState<false | { message: string }>(false);
  const [listening, setListening] = useState(false);
  const [vad, setVAD] = useState<MicVADType | null>(null);

  const userOnFrameProcessed = useEventCallback(vadOptions.onFrameProcessed);
  vadOptions.onFrameProcessed = useEventCallback((probs) => {
    updateUserSpeaking(probs.isSpeech);
    userOnFrameProcessed(probs);
  });
  const { onSpeechEnd, onSpeechStart, onVADMisfire } = vadOptions;
  const _onSpeechEnd = useEventCallback(onSpeechEnd);
  const _onSpeechStart = useEventCallback(onSpeechStart);
  const _onVADMisfire = useEventCallback(onVADMisfire);
  vadOptions.onSpeechEnd = _onSpeechEnd;
  vadOptions.onSpeechStart = _onSpeechStart;
  vadOptions.onVADMisfire = _onVADMisfire;

  useEffect(() => {
    let myvad: MicVADType | null;
    let canceled = false;
    const setup = async (): Promise<void> => {
      try {
        myvad = await (window as any).vad.MicVAD.new(vadOptions);
        if (canceled) {
          myvad?.pause();
          return;
        }
      } catch (e) {
        setLoading(false);
        if (e instanceof Error) {
          setErrored({ message: e.message });
        } else {
          // @ts-ignore
          setErrored({ message: e });
        }
        return;
      }
      setVAD(myvad);
      setLoading(false);
      if (reactOptions.startOnLoad) {
        myvad?.start();
        setListening(true);
      }
    };
    setup().catch((e) => {
      // toast.error('Something went wrong. Please try again later', {
      //   position: 'top-center',
      //   autoClose: 20000,
      // });
      console.error(e);
    });

    return function cleanUp() {
      if (myvad) myvad.pause();

      canceled = true;
      if (!loading && !errored) {
        setListening(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pause = () => {
    if (!loading && !errored) {
      vad?.pause();
      setListening(false);
    }
  };
  const start = () => {
    if (!loading && !errored) {
      vad?.start();
      setListening(true);
    }
  };
  const toggle = () => {
    if (listening) {
      pause();
    } else {
      start();
    }
  };
  return {
    listening,
    errored,
    loading,
    userSpeaking,
    pause,
    start,
    toggle,
  };
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
    ? React.useLayoutEffect
    : React.useEffect;
