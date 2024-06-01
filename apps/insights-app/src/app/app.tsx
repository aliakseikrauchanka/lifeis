// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useRef } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { Button } from '@lifeis/common-ui';
import { UserSession } from './components/user-session/user-session';
import { CONFIG } from '../config';
import { LogForm } from './components/log-form/log-form';
import { startRecording, stopRecording } from './services/recorder.service';
import { transcipt } from './api/audio/audio.api';
import { FileInput } from './components/audio-file/audio-file';

export function App() {
  const [assistantResponse, setAssistantResponse] = React.useState<string>('');
  const [transcription, setTranscription] = React.useState<string>('');
  const ref = useRef<HTMLAudioElement | null>(null);

  const handleRecord = () => {
    startRecording(async (blob: Blob) => {
      const data = await transcipt(blob);
      const t = await data.json();

      setTranscription(t.text);

      if (ref.current) {
        ref.current.src = URL.createObjectURL(blob);
        ref.current.controls = true;
        ref.current.autoplay = true;
      }
    });
  };

  const handleAssistant = async () => {
    const accessToken = localStorage.getItem('accessToken');
    const input = document.getElementById('assistant-input') as HTMLInputElement;
    const text = input.value;
    try {
      // post message
      const checkData = await fetch(`${CONFIG.BE_URL}/check-polish-grammar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      });
      const { threadId, runId } = await checkData.json();

      const intervalId = setInterval(async () => {
        try {
          const runResponse = await fetch(`${CONFIG.BE_URL}/thread/run?threadId=${threadId}&runId=${runId}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const run = await runResponse.json();

          if (run.status === 'completed') {
            clearInterval(intervalId);

            try {
              const messagesResponse = await fetch(`${CONFIG.BE_URL}/thread/messages?threadId=${threadId}`, {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });

              const messagesData = await messagesResponse.json();
              console.log('debug', 'messages', messagesData);
              setAssistantResponse(
                messagesData.messages[0] && messagesData.messages[0][0] && messagesData.messages[0][0].text.value,
              );
            } catch (e) {
              clearInterval(intervalId);
              console.log('error happened during fetch');
            }
          }
        } catch (e) {
          console.log('error happened during fetch');
        }
      }, 2000);
    } catch (e) {
      console.log('error happened during fetch');
    }
  };

  const handleStop = () => {
    stopRecording();
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
      <button onClick={handleRecord}>Record</button>
      <button onClick={handleStop}>Stop Recording</button>
      <div>
        <h3>Audio of recording</h3>
        {transcription && <audio ref={ref}></audio>}
      </div>
      <FileInput />

      <h3>Transcription</h3>
      <p>{transcription}</p>

      <br />
      <br />
      <input id="assistant-input" />
      <button onClick={handleAssistant}>Send</button>
      <div>assistant:</div>
      <div>{assistantResponse}</div>
    </GoogleOAuthProvider>
  );
}

export default App;
