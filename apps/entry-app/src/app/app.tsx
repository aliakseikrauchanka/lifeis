// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { OwnButton, UserSession } from '@lifeis/common-ui';
import { CONFIG } from '../config';

import { Route, Routes } from 'react-router-dom';
import { InsightsPage } from './pages/insights.page';
import { MainPage } from './pages/main.page';
import { AgentsPage } from './pages/agents.page';
import { ExperimentsPage } from './pages/experiments.page';
import { LogsPage } from './pages/logs.page';

export default function App() {
  const handleBEPing = async () => {
    const accessToken = localStorage.getItem('accessToken');
    try {
      await fetch(`${CONFIG.BE_URL}/ping`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (e) {
      console.log('error happened during fetch');
    }
  };

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession />
        <OwnButton onClick={handleBEPing}>Ping BE</OwnButton>
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
