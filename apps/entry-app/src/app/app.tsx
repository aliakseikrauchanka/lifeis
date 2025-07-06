// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useCallback, useEffect, useRef, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import css from './app.module.scss';

import {
  AudioProvider,
  DeepgramContextProvider,
  isUserLoggedIn,
  MicrophoneContextProvider,
  OwnButton,
  SpeechToTextContextProvider,
  UserSession,
  LanguageSelector,
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
import classNames from 'classnames';
import { PlayArrow, SearchRounded } from '@mui/icons-material';

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn() || isOfflineModeOn);
  const {
    audioEnabled,
    setAudioEnabled,
    loggedInUserId,
    setLoggedInUserId,
    languageCode,
    setLanguageCode,
    isFullScreen,
    setIsSearchOpened,
  } = useStorageContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const prevFocusedElement = useRef<HTMLElement | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const blobsRef = useRef<Blob[]>([]);
  const selectRef = useRef(null);

  useEffect(() => {
    //global event listener that will open language select on ctrl + l
    const keydownHandler = (event: any) => {
      if (event.ctrlKey && event.code === 'KeyL') {
        event.preventDefault();
        const a = selectRef.current as any;
        if (!a) {
          return;
        }
        prevFocusedElement.current = document.activeElement as HTMLElement;
        const selectButton = a.querySelector('button');
        if (selectButton) {
          selectButton.focus();
          selectButton.click();
        }
      }
    };
    document.addEventListener('keydown', keydownHandler);

    return () => {
      document.removeEventListener('keydown', keydownHandler);
    };
  }, [selectRef]);

  const handlePlayRecordedAudio = useCallback(() => {
    if (audioRef.current) {
      const concatenatedBlob = new Blob(blobsRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(concatenatedBlob);

      // can I open it in separate tab?
      window.open(audioUrl, '_blank');

      audioRef.current.src = audioUrl;
      audioRef.current.play();

      // audioRef.current.onended = () => {
      //   URL.revokeObjectURL(audioUrl);
      // };
    }
  }, [blobsRef]);

  const handleOnGetBlob = useCallback((blob: Blob) => {
    blobsRef.current.push(blob);
  }, []);

  const handleLanguageChange = useCallback((_: any, newLanguageValue: string | null) => {
    setLanguageCode(newLanguageValue as string);
    // }
  }, []);

  const handleLanguageClose = useCallback(() => {
    if (prevFocusedElement.current) {
      setTimeout(() => {
        prevFocusedElement.current?.focus();
        prevFocusedElement.current = null;
      }, 100);
    }
  }, [prevFocusedElement]);

  const { hasExperimentsFeature } = useFeatureFlags(isLoggedIn, loggedInUserId);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      isOffline: isOfflineModeOn,
    });
    setIsInitialized(true);
  }, []);

  const getDeepgramLanguage = useCallback(() => {
    if (languageCode === 'cs-CZ') {
      return 'cs';
    }
    if (languageCode === 'de-DE') {
      return 'de';
    }
    if (languageCode === 'fr-FR') {
      return 'fr';
    }
    return languageCode;
  }, [languageCode]);

  return (
    isInitialized && (
      <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
        <main className={css.main}>
          <audio ref={audioRef} />
          <header
            className={classNames(css.header, {
              [css.headerHidden]: isFullScreen,
            })}
          >
            <UserSession
              isOfflineMode={isOfflineModeOn}
              isLoggedIn={isLoggedIn}
              onLoginSuccess={(googleUserId) => {
                setIsLoggedIn(true);
                setLoggedInUserId(googleUserId);
              }}
              onLogOut={() => setIsLoggedIn(false)}
            />
            <div style={{ position: 'absolute', top: '4px', right: '70px', display: 'flex', maxHeight: '30px' }}>
              {audioEnabled && (
                <LanguageSelector
                  languageCode={languageCode}
                  selectRef={selectRef}
                  handleLanguageChange={handleLanguageChange}
                  handleLanguageClose={handleLanguageClose}
                  sx={{ minWidth: '50px' }}
                />
              )}
              <OwnButton
                onClick={() => {
                  setIsSearchOpened((prev) => !prev);
                }}
                style={{
                  marginRight: '10px',
                }}
              >
                <SearchRounded />
              </OwnButton>
              {audioEnabled && (
                <OwnButton
                  type="button"
                  onClick={handlePlayRecordedAudio}
                  color="success"
                  style={{
                    marginRight: '10px',
                  }}
                >
                  <PlayArrow />
                </OwnButton>
              )}
              <OwnButton
                type="button"
                color="success"
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                }}
              >
                {audioEnabled ? 'Disable stt' : 'Enable stt'}
              </OwnButton>
            </div>
          </header>

          {isLoggedIn && (
            <div className={css.content}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <AudioSwitch
                      audioElement={
                        <MicrophoneContextProvider>
                          <DeepgramContextProvider language={getDeepgramLanguage()}>
                            <AudioProvider>
                              <SpeechToTextContextProvider onBlob={handleOnGetBlob}>
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
            </div>
          )}
        </main>
      </GoogleOAuthProvider>
    )
  );
}
