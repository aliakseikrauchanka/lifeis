// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useCallback, useEffect, useRef, useState } from 'react';

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
import { Select, Option } from '@mui/joy';

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn() || isOfflineModeOn);
  const { audioEnabled, setAudioEnabled, loggedInUserId, setLoggedInUserId } = useStorageContext();
  const [isIniitialized, setIsInitialized] = useState(false);
  const [language, setLanguage] = useState('ru-RU');

  const audioRef = useRef<HTMLAudioElement>(null);

  const blobsRef = useRef<Blob[]>([]);

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

  const handleLanguageChange = useCallback(
    (_: any, newLanguageValue: string | null) => setLanguage(newLanguageValue as string),
    [],
  );

  const { hasAudioFeature, hasLogsFeature, hasExperimentsFeature } = useFeatureFlags(isLoggedIn, loggedInUserId);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      isOffline: isOfflineModeOn,
    });
    setIsInitialized(true);
  }, []);

  return isIniitialized ? (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <audio ref={audioRef} />
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
        <div style={{ position: 'absolute', top: '4px', right: '70px', display: 'flex' }}>
          {hasAudioFeature && (
            // toggle of ru-RU and en-US languages
            <>
              {audioEnabled && (
                <>
                  <OwnButton type="button" onClick={handlePlayRecordedAudio} color="success">
                    Play recorded audio
                  </OwnButton>
                  <Select value={language} onChange={handleLanguageChange} sx={{ minWidth: 120, minHeight: '1.75rem' }}>
                    <Option value="ru-RU">ru</Option>
                    <Option value="en-US">en</Option>
                    <Option value="pl">pl</Option>
                  </Select>
                </>
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
            </>
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
                    <DeepgramContextProvider language={language}>
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
      )}
    </GoogleOAuthProvider>
  ) : null;
}
