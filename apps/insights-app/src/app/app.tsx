// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleOAuthProvider } from '@react-oauth/google';
import { OwnButton, UserSession, init, isUserLoggedIn, utilFetch } from '@lifeis/common-ui';

import { Route, Routes, Link } from 'react-router-dom';
import { CONFIG } from '../config';
import { MainPage } from './pages/main.page';
import { useEffect, useState } from 'react';
import { InsightsPage } from './pages/insights.page';

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());
  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      app: 'insights',
    });
  }, []);

  const handleBEPing = async () => {
    try {
      await utilFetch(`/ping`, {
        method: 'GET',
      });
    } catch (e) {
      console.log('error happened during fetch');
    }
  };

  return (
    <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
      <header>
        <UserSession
          isLoggedIn={isLoggedIn}
          onLoginSuccess={() => setIsLoggedIn(true)}
          onLogOut={() => setIsLoggedIn(false)}
        />
        <OwnButton onClick={handleBEPing}>Ping BE</OwnButton>
      </header>
      <div>
        <div role="navigation">
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/page-2">main page</Link>
            </li>
          </ul>
        </div>
        <Routes>
          <Route path="/" element={<InsightsPage />} />
          <Route
            path="/page-2"
            element={
              <div>
                <Link to="/">Click here to go back to root page.</Link>
                <MainPage />
              </div>
            }
          />
        </Routes>
        {/* END: routes */}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
