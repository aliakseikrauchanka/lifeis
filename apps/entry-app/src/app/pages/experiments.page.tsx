import React, { useRef } from 'react';
import { startRecording, stopRecording } from '../services/recorder.service';
import { transcript } from '../api/audio/audio.api';
import { FileInput } from '../components/audio-file/audio-file';
import { checkPolishGrammar, translateToPolish } from '../api/assistants/assistants.api';
import { OwnButton } from '@lifeis/common-ui';
import { Link } from 'react-router-dom';

export const ExperimentsPage = () => {
  const [assistantResponse, setAssistantResponse] = React.useState<string>('');
  const [geminiAssistantResponse, setGeminiAssistantResponse] = React.useState<string>('');
  const [transcription, setTranscription] = React.useState<string>('');
  const ref = useRef<HTMLAudioElement | null>(null);

  const handleRecord = () => {
    startRecording(async (blob: Blob) => {
      const data = await transcript(blob);
      const t = await data.json();

      setTranscription(t.text);

      if (ref.current) {
        ref.current.src = URL.createObjectURL(blob);
        ref.current.controls = true;
        ref.current.autoplay = true;
      }
    });
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleAssistant = async () => {
    const input = document.getElementById('assistant-input') as HTMLInputElement;
    const text = input.value;

    const response = await checkPolishGrammar(text);
    setAssistantResponse(response);
  };

  const handleGeminiAssistant = async () => {
    const input = document.getElementById('gemini-assistant-input') as HTMLInputElement;
    const text = input.value;
    const response = await translateToPolish(text);
    setGeminiAssistantResponse(response);
  };
  return (
    <main>
      <div>
        <Link to="/">Click here to go back to root page.</Link>
      </div>

      <OwnButton onClick={handleRecord}>Record</OwnButton>
      <OwnButton onClick={handleStop}>Stop Recording</OwnButton>
      <div>
        <h3>Audio of recording</h3>
        {transcription && <audio ref={ref}></audio>}
      </div>
      <FileInput />

      <h3>Transcription</h3>
      <p>{transcription}</p>
      <br />

      <h3>Open AI</h3>
      <input id="assistant-input" />
      <OwnButton onClick={handleAssistant}>Send</OwnButton>
      <div>OpenAI assistant response:</div>
      <div>{assistantResponse}</div>

      <br />

      <h3>Gemini</h3>
      <input id="gemini-assistant-input" />
      <OwnButton onClick={handleGeminiAssistant}>Translate to Polish with Gemini</OwnButton>
      <div>Gemini assistant response:</div>
      <div>{geminiAssistantResponse}</div>

      <br />
    </main>
  );
};
