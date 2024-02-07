// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useRef } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { Button } from '@lifeis/common-ui';
import { UserSession } from './components/user-session/user-session';
import { CONFIG } from '../config';
import { LogForm } from './components/log-form/log-form';
import { startRecording, stopRecording } from './services/recorder.service';

export function App() {
  const [transcription, setTranscription] = React.useState<string>('');
  const ref = useRef<HTMLAudioElement | null>(null);

  const handleRecord = () => {
    startRecording(async (blob) => {
      const accessToken = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('audio', blob);

      const data = await fetch(`${CONFIG.BE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const t = await data.json();
      setTranscription(t.text);

      console.log('recording stopped');
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
      <h3>Transcription</h3>
      <p>{transcription}</p>
    </GoogleOAuthProvider>
  );
}

export default App;
