import { GoogleOAuthProvider } from '@react-oauth/google';
import { AudioDevicesProvider, UserSession, init, isUserLoggedIn } from '@lifeis/common-ui';
import { NavLink, Route, Routes } from 'react-router-dom';
import { CONFIG } from '../config';
import { useEffect, useState } from 'react';
import { StudyPage } from './pages/study.page';
import { LibraryPage } from './pages/library.page';
import { SentenceTrainingPage } from './pages/sentence-training.page';
import { SentenceConstructionPage } from './pages/sentence-construction.page';
import { MicSelector } from './components/mic-selector';
import { HeadsetSelector } from './components/headset-selector';

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isUserLoggedIn());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    init({
      beUrl: CONFIG.BE_URL,
      clientId: CONFIG.CLIENT_ID,
      app: 'training',
    });
    setIsInitialized(true);
  }, []);

  return (
    isInitialized && (
      <GoogleOAuthProvider clientId={CONFIG.CLIENT_ID}>
        <AudioDevicesProvider>
          <div className="flex flex-col h-full">
            <header className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-1 border-b border-black/5 shadow-sm">
              {isLoggedIn && (
                <nav className="flex items-center gap-1">
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    Study
                  </NavLink>
                  <NavLink
                    to="/sentence-training"
                    className={({ isActive }) =>
                      `px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    Sentence Training
                  </NavLink>
                  <NavLink
                    to="/sentence-construction"
                    className={({ isActive }) =>
                      `px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    Sentence Construction
                  </NavLink>
                  <NavLink
                    to="/library"
                    className={({ isActive }) =>
                      `px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    Library
                  </NavLink>
                </nav>
              )}
              <div className="ml-auto flex items-center gap-1">
                {isLoggedIn && <MicSelector />}
                {isLoggedIn && <HeadsetSelector />}
                <UserSession
                  isLoggedIn={isLoggedIn}
                  onLoginSuccess={() => setIsLoggedIn(true)}
                  onLogOut={() => setIsLoggedIn(false)}
                />
              </div>
            </header>
            {isLoggedIn && (
              <main className="flex-1 min-h-0 overflow-auto">
                <Routes>
                  <Route path="/" element={<StudyPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/sentence-training" element={<SentenceTrainingPage />} />
                  <Route path="/sentence-construction" element={<SentenceConstructionPage />} />
                </Routes>
              </main>
            )}
          </div>
        </AudioDevicesProvider>
      </GoogleOAuthProvider>
    )
  );
}

export default App;
