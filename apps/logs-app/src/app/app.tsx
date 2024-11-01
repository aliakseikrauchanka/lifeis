// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleOAuthProvider } from '@react-oauth/google';
import { UserSession, init, isUserLoggedIn } from '@lifeis/common-ui';

import { Route, Routes, Link } from 'react-router-dom';
import { CONFIG } from '../config';
import { MainPage } from './pages/main.page';
import { useEffect, useState } from 'react';

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
            <Route path="/" element={<MainPage />} />
            <Route
              path="/page-2"
              element={
                <div>
                  <Link to="/">Click here to go back to root page.</Link>
                </div>
              }
            />
          </Routes>
        </div>
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
