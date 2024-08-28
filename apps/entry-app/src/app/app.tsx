// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useEffect, useState } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { isUserLoggedIn, UserSession } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { InsightsPage } from './pages/insights.page';
import { MainPage } from './pages/main.page';
import { AgentsPage } from './pages/agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { LogsPage } from './pages/logs.page';
import { init } from '@lifeis/common-ui';
import './styles/reset.css';
import { StorageProvider } from './contexts/storage.context';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());

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
      </header>

      {isLoggedIn && (
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route
            path="/agents"
            element={
              <StorageProvider>
                <AgentsPage />
              </StorageProvider>
            }
          />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
        </Routes>
      )}
    </GoogleOAuthProvider>
  );
}
