// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useEffect } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { UserSession } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { InsightsPage } from './pages/insights.page';
import { MainPage } from './pages/main.page';
import { AgentsPage } from './pages/agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { LogsPage } from './pages/logs.page';
import { init } from '@lifeis/common-ui';
import './styles/reset.css';

export default function App() {
  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
    });
  }, []);

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession />
      </header>

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/experiments" element={<ExperimentsPage />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}
