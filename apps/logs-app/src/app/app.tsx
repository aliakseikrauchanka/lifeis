// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleOAuthProvider } from '@react-oauth/google';
import { DeepgramFileSTTProvider, UserSession, init, isUserLoggedIn } from '@lifeis/common-ui';

import { NavLink, Route, Routes } from 'react-router-dom';
import { AudioDevicesProvider, useAudioDevices, AudioDeviceSelector } from '@lifeis/common-ui';
import { CONFIG } from '../config';
import { useEffect, useState } from 'react';
import { LogsPage } from './pages/logs.page';
import { LogsChatPage } from './pages/logs-chat.page';
import { BasketsPage } from './pages/baskets.page';
import { UploadPage } from './pages/upload.page';
import css from './app.module.scss';

function DeepgramWithDevices({ children }: { children: React.ReactNode }) {
  const { inputDeviceId, outputDeviceId } = useAudioDevices();
  return (
    <DeepgramFileSTTProvider
      language="ru"
      audioInputDeviceId={inputDeviceId || undefined}
      audioOutputDeviceId={outputDeviceId || undefined}
    >
      {children}
    </DeepgramFileSTTProvider>
  );
}

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
        <AudioDevicesProvider>
          <div className={css.appLayout}>
            <header className={css.header}>
              {isLoggedIn && (
                <nav className={css.nav}>
                  <NavLink to="/" end className={({ isActive }) => (isActive ? css.active : undefined)}>
                    Home
                  </NavLink>
                  <NavLink to="/chat" className={({ isActive }) => (isActive ? css.active : undefined)}>
                    Chat
                  </NavLink>
                  <NavLink to="/baskets" className={({ isActive }) => (isActive ? css.active : undefined)}>
                    Baskets
                  </NavLink>
                  <NavLink to="/upload" className={({ isActive }) => (isActive ? css.active : undefined)}>
                    Upload
                  </NavLink>
                </nav>
              )}
              {isLoggedIn && <AudioDeviceSelector />}
              <UserSession
                isLoggedIn={isLoggedIn}
                onLoginSuccess={() => setIsLoggedIn(true)}
                onLogOut={() => setIsLoggedIn(false)}
              />
            </header>
            {isLoggedIn && (
              <div className={css.mainContent}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <DeepgramWithDevices>
                        <LogsPage />
                      </DeepgramWithDevices>
                    }
                  />
                  <Route
                    path="/chat"
                    element={
                      <DeepgramWithDevices>
                        <LogsChatPage />
                      </DeepgramWithDevices>
                    }
                  />
                  <Route path="/upload" element={<UploadPage />} />
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
          </div>
        </AudioDevicesProvider>
      </GoogleOAuthProvider>
    )
  );
}

export default App;
