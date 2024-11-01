'use client';

import { init, isUserLoggedIn, UserSession } from '@lifeis/common-ui';
import { useEffect, useState } from 'react';

import { CONFIG } from '../config';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AllInsights } from './components/all-insights/all-insights';

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      app: 'insights',
    });
    setIsInitialized(true);
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
      {isLoggedIn && isInitialized && (
        <div>
          <AllInsights />
        </div>
      )}
    </GoogleOAuthProvider>
  );
}
