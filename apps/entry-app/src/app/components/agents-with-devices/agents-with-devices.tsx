import {
  AudioProvider,
  DeepgramContextProvider,
  DeepgramFileSTTProvider,
  ElevenLabsSTTProvider,
  MicrophoneContextProvider,
  SpeechToTextContextProvider,
  useAudioDevices,
} from '@lifeis/common-ui';
import { AllAgentsPage } from '../../pages/all-agents.page';
import { SttProviderType } from '../../contexts/storage.context';

interface IAgentsWithDevicesProps {
  sttProvider: SttProviderType;
  getDeepgramLanguage: () => string;
  getElevenLabsLanguage: () => string;
  onBlob: (blob: Blob) => void;
}

export function AgentsWithDevices({
  sttProvider,
  getDeepgramLanguage,
  getElevenLabsLanguage,
  onBlob,
}: IAgentsWithDevicesProps) {
  const { inputDeviceId, outputDeviceId } = useAudioDevices();
  const inputId = inputDeviceId || undefined;
  const outputId = outputDeviceId || undefined;

  if (sttProvider === 'elevenlabs') {
    return (
      <ElevenLabsSTTProvider language={getElevenLabsLanguage()} audioInputDeviceId={inputId}>
        <AllAgentsPage />
      </ElevenLabsSTTProvider>
    );
  }
  if (sttProvider === 'deepgram-file') {
    return (
      <DeepgramFileSTTProvider
        language={getDeepgramLanguage()}
        audioInputDeviceId={inputId}
        audioOutputDeviceId={outputId}
      >
        <AllAgentsPage />
      </DeepgramFileSTTProvider>
    );
  }
  return (
    <MicrophoneContextProvider audioInputDeviceId={inputId}>
      <DeepgramContextProvider language={getDeepgramLanguage()}>
        <AudioProvider>
          <SpeechToTextContextProvider onBlob={onBlob} audioOutputDeviceId={outputId}>
            <AllAgentsPage />
          </SpeechToTextContextProvider>
        </AudioProvider>
      </DeepgramContextProvider>
    </MicrophoneContextProvider>
  );
}
