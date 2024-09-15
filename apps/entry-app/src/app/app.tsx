// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useEffect, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { isUserLoggedIn, OwnButton, UserSession } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { InsightsPage } from './pages/insights.page';
import { MainPage } from './pages/main.page';
import { AgentsPage } from './pages/agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { LogsPage } from './pages/logs.page';
import { init } from '@lifeis/common-ui';
import './styles/reset.css';
import { DeepgramContextProvider } from './contexts/deepgram.context';
import { MicrophoneContextProvider } from './contexts/microphone.context';
import { SpeechToTextContextProvider } from './contexts/speech-to-text.context';
import AudioProvider from './components/audio-provider/audio-provider';
import AudioSwitch from './components/audio-switch/audio-switch';
import { useStorageContext } from './contexts/storage.context';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());
  const { audioEnabled, setAudioEnabled } = useStorageContext();

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
    });
  }, []);

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession
          isLoggedIn={isLoggedIn}
          onLoginSuccess={() => setIsLoggedIn(true)}
          onLogOut={() => setIsLoggedIn(false)}
        />
        <div style={{ position: 'absolute', top: '10px', right: '70px' }}>
          <OwnButton
            type="button"
            color="success"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
            }}
          >
            toggle audio
          </OwnButton>
        </div>
      </header>

      {isLoggedIn && (
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route
            path="/agents"
            element={
              <AudioSwitch
                audioElement={
                  <MicrophoneContextProvider>
                    <DeepgramContextProvider>
                      <AudioProvider>
                        <SpeechToTextContextProvider>
                          <AgentsPage />
                        </SpeechToTextContextProvider>
                      </AudioProvider>
                    </DeepgramContextProvider>
                  </MicrophoneContextProvider>
                }
                nonAudioElement={<AgentsPage />}
              />
            }
          />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route
            path="/logs"
            element={
              <AudioSwitch
                audioElement={
                  <MicrophoneContextProvider>
                    <DeepgramContextProvider>
                      <AudioProvider>
                        <SpeechToTextContextProvider>
                          <LogsPage />
                        </SpeechToTextContextProvider>
                      </AudioProvider>
                    </DeepgramContextProvider>
                  </MicrophoneContextProvider>
                }
                nonAudioElement={<LogsPage />}
              />
            }
          />
          <Route path="/insights" element={<InsightsPage />} />
        </Routes>
      )}
    </GoogleOAuthProvider>
  );
}
