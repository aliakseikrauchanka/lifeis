import { useCallback, useRef, useState } from 'react';

interface AudioRecorderHook {
  start: () => void;
  pause: () => Blob; // audio blob
  isRecording: boolean;
}

export const useAudioRecorder = (sampleRate: number): AudioRecorderHook => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const audioContext = useRef<AudioContext | null>(null);
  const audioStream = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioChunks = useRef<Float32Array[]>([]);

  const start = useCallback(() => {
    if (isRecording) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        audioContext.current = new AudioContext({ sampleRate });
        audioStream.current = audioContext.current.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.current.createScriptProcessor(4096, 1, 1);

        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputBuffer = audioProcessingEvent.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          audioChunks.current.push(new Float32Array(inputData));
        };

        audioStream.current.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.current.destination);

        setIsRecording(true);
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
      });
  }, [isRecording, sampleRate]);

  const pause = useCallback(() => {
    if (!isRecording) {
      throw new Error('Audio is not recording');
    }

    if (!audioContext.current) {
      throw new Error('AudioContext is not initialized');
    }

    audioContext.current.close();
    const audioData = mergeAudioBuffers(audioChunks.current, sampleRate);
    const wavBlob = createWavFile(audioData, sampleRate);
    audioChunks.current = [];
    setIsRecording(false);

    return wavBlob;
  }, [isRecording, sampleRate]);

  return { start, pause, isRecording };
};

function mergeAudioBuffers(buffers: Float32Array[], sampleRate: number): Float32Array {
  let totalLength = 0;
  for (const buffer of buffers) {
    totalLength += buffer.length;
  }

  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

function createWavFile(audioData: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeUTFBytes(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeUTFBytes(view, 8, 'WAVE');

  // FMT sub-chunk
  writeUTFBytes(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, 1, true); // num of channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // Data sub-chunk
  writeUTFBytes(view, 36, 'data');
  view.setUint32(40, audioData.length * 2, true);

  // Write the PCM samples
  const length = audioData.length;
  let index = 44;
  for (let i = 0; i < length; i++) {
    view.setInt16(index, audioData[i] * 0x7fff, true);
    index += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
