import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_INPUT = 'audio-input-device';
const STORAGE_OUTPUT = 'audio-output-device';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface AudioDevicesContextValue {
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  inputDeviceId: string;
  outputDeviceId: string;
  setInputDeviceId: (id: string) => void;
  setOutputDeviceId: (id: string) => void;
  refreshDevices: () => Promise<void>;
}

const AudioDevicesContext = createContext<AudioDevicesContextValue | undefined>(undefined);

export function AudioDevicesProvider({ children }: { children: React.ReactNode }) {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDeviceId, setInputDeviceIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_INPUT) ?? '';
  });
  const [outputDeviceId, setOutputDeviceIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_OUTPUT) ?? '';
  });

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        kind: 'audioinput' as const,
      }));
    const outputs = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
        kind: 'audiooutput' as const,
      }));
    setInputDevices(inputs);
    setOutputDevices(outputs);
  }, []);

  useEffect(() => {
    refreshDevices();
    const onDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
  }, [refreshDevices]);

  const setInputDeviceId = useCallback((id: string) => {
    setInputDeviceIdState(id);
    localStorage.setItem(STORAGE_INPUT, id);
  }, []);

  const setOutputDeviceId = useCallback((id: string) => {
    setOutputDeviceIdState(id);
    localStorage.setItem(STORAGE_OUTPUT, id);
  }, []);

  return (
    <AudioDevicesContext.Provider
      value={{
        inputDevices,
        outputDevices,
        inputDeviceId,
        outputDeviceId,
        setInputDeviceId,
        setOutputDeviceId,
        refreshDevices,
      }}
    >
      {children}
    </AudioDevicesContext.Provider>
  );
}

export function useAudioDevices(): AudioDevicesContextValue {
  const ctx = useContext(AudioDevicesContext);
  if (!ctx) throw new Error('useAudioDevices must be used within AudioDevicesProvider');
  return ctx;
}
