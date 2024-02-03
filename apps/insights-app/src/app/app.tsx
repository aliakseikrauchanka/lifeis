// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { Button } from '@lifeis/common-ui';
import { UserSession } from './components/user-session/user-session';
import { CONFIG } from '../config';

export function App() {
  const handleTestBEClick = async () => {
    const accessToken = localStorage.getItem('accessToken');
    console.log('accessToken:', accessToken);
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
      <div>
        <UserSession />
        <Button onClick={handleTestBEClick}>Ping BE</Button>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
