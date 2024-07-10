// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useRef } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { Button } from '@lifeis/common-ui';
import { UserSession } from './components/user-session/user-session';
import { CONFIG } from '../config';
import { LogForm } from './components/log-form/log-form';
import { startRecording, stopRecording } from './services/recorder.service';
import { transcript } from './api/audio/audio.api';
import { FileInput } from './components/audio-file/audio-file';
import { checkGrammar, translateToPolish } from './api/assistants/assistants.api';

export function App() {
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

    const response = await checkGrammar(text);
    setAssistantResponse(response);
  };

  const handleGeminiAssistant = async () => {
    const input = document.getElementById('gemini-assistant-input') as HTMLInputElement;
    const text = input.value;
    const response = await translateToPolish(text);
    setGeminiAssistantResponse(response);
  };

  const handleBEPing = async () => {
    const accessToken = localStorage.getItem('accessToken');
    try {
      await fetch(`${CONFIG.BE_URL}/ping`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (e) {
      console.log('error happened during fetch');
    }
  };

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession />
        <Button onClick={handleBEPing}>Ping BE</Button>
      </header>
      <LogForm />
      <Button onClick={handleRecord}>Record</Button>
      <Button onClick={handleStop}>Stop Recording</Button>
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
      <Button onClick={handleAssistant}>Send</Button>
      <div>OpenAI assistant response:</div>
      <div>{assistantResponse}</div>

      <br />

      <h3>Gemini</h3>
      <input id="gemini-assistant-input" />
      <Button onClick={handleGeminiAssistant}>Translate to Polish with Gemini</Button>
      <div>Gemini assistant response:</div>
      <div>{geminiAssistantResponse}</div>
    </GoogleOAuthProvider>
  );
}

export default App;
