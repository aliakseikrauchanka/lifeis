// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useEffect, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import {
  AudioProvider,
  DeepgramContextProvider,
  isUserLoggedIn,
  MicrophoneContextProvider,
  OwnButton,
  SpeechToTextContextProvider,
  UserSession,
} from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { AgentsPage } from './pages/agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { init } from '@lifeis/common-ui';
import './styles/reset.css';
import AudioSwitch from './components/audio-switch/audio-switch';
import { useStorageContext } from './contexts/storage.context';
import { useFeatureFlags } from './hooks/ff.hook';

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn() || isOfflineModeOn);
  const { audioEnabled, setAudioEnabled, loggedInUserId, setLoggedInUserId } = useStorageContext();

  const { hasAudioFeature, hasLogsFeature, hasExperimentsFeature } = useFeatureFlags(isLoggedIn, loggedInUserId);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      isOffline: isOfflineModeOn,
    });
  }, []);

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession
          isOfflineMode={isOfflineModeOn}
          isLoggedIn={isLoggedIn}
          onLoginSuccess={(googleUserId) => {
            setIsLoggedIn(true);
            setLoggedInUserId(googleUserId);
          }}
          onLogOut={() => setIsLoggedIn(false)}
        />
        <div style={{ position: 'absolute', top: '4px', right: '70px' }}>
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
        </Routes>
      )}
    </GoogleOAuthProvider>
  );
}
