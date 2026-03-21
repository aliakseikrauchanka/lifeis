// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleOAuthProvider } from '@react-oauth/google';
import { DeepgramFileSTTProvider, UserSession, init, isUserLoggedIn } from '@lifeis/common-ui';

import { NavLink, Route, Routes } from 'react-router-dom';
import { CONFIG } from '../config';
import { useEffect, useState } from 'react';
import { LogsPage } from './pages/logs.page';
import { LogsChatPage } from './pages/logs-chat.page';
import { BasketsPage } from './pages/baskets.page';
import css from './app.module.scss';

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
              </nav>
            )}
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
                    <DeepgramFileSTTProvider language="ru">
                      <LogsPage />
                    </DeepgramFileSTTProvider>
                  }
                />
                <Route path="/chat" element={<LogsChatPage />} />
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
      </GoogleOAuthProvider>
    )
  );
}

export default App;
