// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  AudioProvider,
  DeepgramContextProvider,
  MicrophoneContextProvider,
  SpeechToTextContextProvider,
  UserSession,
  init,
  isUserLoggedIn,
} from '@lifeis/common-ui';

import { Route, Routes, Link } from 'react-router-dom';
import { CONFIG } from '../config';
import { useEffect, useState } from 'react';
import { LogsPage } from './pages/logs.page';
import { BasketsPage } from './pages/baskets.page';
import { Stack } from '@mui/material';

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      app: 'logs',
    });
    setIsInitialized(true);
  }, []);

  return (
    isInitialized && (
      <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
        <header>
          <UserSession
            isLoggedIn={isLoggedIn}
            onLoginSuccess={() => setIsLoggedIn(true)}
            onLogOut={() => setIsLoggedIn(false)}
          />
        </header>
        {isLoggedIn && (
          <div>
            <Stack direction="row" spacing={2}>
              <Link to="/">Home</Link>
              <Link to="/baskets">Baskets</Link>
            </Stack>

            <Routes>
              <Route
                path="/"
                element={
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
              />
              <Route
                path="/baskets"
                element={
                  <div>
                    <BasketsPage />
                  </div>
                }
              />
            </Routes>
          </div>
        )}
      </GoogleOAuthProvider>
    )
  );
}

export default App;
