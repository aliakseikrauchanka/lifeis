import { useCallback, useEffect, useRef, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import css from './app.module.scss';

import { AudioDevicesProvider, isUserLoggedIn } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { AllAgentsPage } from './pages/all-agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { init } from '@lifeis/common-ui';
import './styles/reset.css';
import AudioSwitch from './components/audio-switch/audio-switch';
import { useStorageContext } from './contexts/storage.context';
import { useFeatureFlags } from './hooks/ff.hook';
import { useLanguageCodes } from './hooks/use-language-codes.hook';
import classNames from 'classnames';
import { AgentsWithDevices } from './components/agents-with-devices/agents-with-devices';
import { AppHeader } from './components/app-header/app-header';

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn() || isOfflineModeOn);
  const { loggedInUserId, setLoggedInUserId, isFullScreen, sttProvider } = useStorageContext();
  const [isInitialized, setIsInitialized] = useState(false);

  const blobsRef = useRef<Blob[]>([]);

  const { getDeepgramLanguage, getElevenLabsLanguage } = useLanguageCodes();
  useFeatureFlags(isLoggedIn, loggedInUserId);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      isOffline: isOfflineModeOn,
    });
    setIsInitialized(true);
  }, []);

  const handleOnGetBlob = useCallback((blob: Blob) => {
    blobsRef.current.push(blob);
  }, []);

  return (
    isInitialized && (
      <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
        <AudioDevicesProvider>
          <main
            className={classNames(css.main, {
              [css.mainFullScreen]: isFullScreen,
            })}
          >
            <AppHeader
              isOfflineMode={isOfflineModeOn}
              isLoggedIn={isLoggedIn}
              onLoginSuccess={(googleUserId) => {
                setIsLoggedIn(true);
                setLoggedInUserId(googleUserId);
              }}
              onLogOut={() => setIsLoggedIn(false)}
            />

            {isLoggedIn && (
              <div className={css.content}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <AudioSwitch
                        audioElement={
                          <AgentsWithDevices
                            sttProvider={sttProvider}
                            getDeepgramLanguage={getDeepgramLanguage}
                            getElevenLabsLanguage={getElevenLabsLanguage}
                            onBlob={handleOnGetBlob}
                          />
                        }
                        nonAudioElement={<AllAgentsPage />}
                      />
                    }
                  />
                  <Route path="/experiments" element={<ExperimentsPage />} />
                </Routes>
              </div>
            )}
          </main>
        </AudioDevicesProvider>
      </GoogleOAuthProvider>
    )
  );
}
