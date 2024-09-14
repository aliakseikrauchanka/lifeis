import { RealTimeVADOptions } from '@ricky0123/vad-web';

export interface ReactOptions {
  startOnLoad: boolean;
  userSpeakingThreshold: number;
}

export type ReactRealTimeVADOptions = RealTimeVADOptions & ReactOptions;

export const useMicVADConfig = () => {
  const defaultRealTimeVADOptions = (window as any).vad.defaultRealTimeVADOptions;

  const defaultReactOptions: ReactOptions = {
    startOnLoad: false,
    userSpeakingThreshold: 0.3,
  };

  const defaultReactRealTimeVADOptions = {
    ...defaultRealTimeVADOptions,
    ...defaultReactOptions,
  };

  const reactOptionKeys = Object.keys(defaultReactOptions);
  const vadOptionKeys = Object.keys(defaultRealTimeVADOptions);

  const _filter = (keys: string[], obj: any) => {
    return keys.reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as { [key: string]: any });
  };

  function useOptions(options: Partial<ReactRealTimeVADOptions>): [ReactOptions, RealTimeVADOptions] {
    options = { ...defaultReactRealTimeVADOptions, ...options };
    const reactOptions = _filter(reactOptionKeys, options) as ReactOptions;
    const vadOptions = _filter(vadOptionKeys, options) as RealTimeVADOptions;
    return [reactOptions, vadOptions];
  }

  return {
    useOptions,
  };
};
