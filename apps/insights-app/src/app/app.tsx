// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { Button } from '@lifeis/common-ui';
import { UserSession } from './components/user-session/user-session';
import { CONFIG } from '../config';
import { LogForm } from './components/log-form/log-form';

export function App() {
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
        <Button onClick={handleBEPing}>Ping BE</Button>
      </header>
      <LogForm />
    </GoogleOAuthProvider>
  );
}

export default App;
