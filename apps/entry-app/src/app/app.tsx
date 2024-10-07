// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useEffect, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { useFlags } from 'flagsmith/react';

import { getGoogleUserId, isUserLoggedIn, OwnButton, UserSession } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
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
  const [loggedInGoogleUserId, setLoggedInGoogleUserId] = useState<string>(getGoogleUserId());
  const { audioEnabled, setAudioEnabled } = useStorageContext();
  const { stt_feature, logs_feature, experiments_feature } = useFlags<
    'stt_feature' | 'logs_feature' | 'experiments_feature'
  >(['stt_feature', 'logs_feature', 'experiments_feature']);

  // TODO: redo logic of FFs
  const hasAudioFeature =
    stt_feature.enabled &&
    loggedInGoogleUserId &&
    stt_feature.value &&
    JSON.parse(String(stt_feature.value)).indexOf(loggedInGoogleUserId) > -1;

  const hasLogsFeature =
    logs_feature.enabled &&
    loggedInGoogleUserId &&
    logs_feature.value &&
    JSON.parse(String(stt_feature.value)).indexOf(loggedInGoogleUserId) > -1;

  const hasExperimentsFeature =
    experiments_feature.enabled &&
    loggedInGoogleUserId &&
    experiments_feature.value &&
    JSON.parse(String(stt_feature.value)).indexOf(loggedInGoogleUserId) > -1;

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
          onLoginSuccess={(googleUserId) => {
            setIsLoggedIn(true);
            setLoggedInGoogleUserId(googleUserId);
          }}
          onLogOut={() => setIsLoggedIn(false)}
        />
        <div style={{ position: 'absolute', top: '10px', right: '70px' }}>
          {hasAudioFeature && (
            <OwnButton
              type="button"
              color="success"
              onClick={() => {
                setAudioEnabled(!audioEnabled);
              }}
            >
              toggle audio
            </OwnButton>
          )}
        </div>
      </header>

      {isLoggedIn && (
        <Routes>
          <Route
            path="/"
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
          {hasExperimentsFeature && <Route path="/experiments" element={<ExperimentsPage />} />}
          {hasLogsFeature && (
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
          )}
        </Routes>
      )}
    </GoogleOAuthProvider>
  );
}
