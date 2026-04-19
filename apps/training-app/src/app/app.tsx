import { GoogleOAuthProvider } from '@react-oauth/google';
import { AudioDevicesProvider, UserSession, init, isUserLoggedIn } from '@lifeis/common-ui';
import { NavLink, Route, Routes } from 'react-router-dom';
import { CONFIG } from '../config';
import { useEffect, useState } from 'react';
import { BookOpen, Brain, PenLine, Blocks, Type, Library as LibraryIcon } from 'lucide-react';
import { StudyPage } from './pages/study.page';
import { LibraryPage } from './pages/library.page';
import { SentenceTrainingPage } from './pages/sentence-training.page';
import { SentenceConstructionPage } from './pages/sentence-construction.page';
import { SentenceBuilderPage } from './pages/sentence-builder.page';
import { WordBuilderPage } from './pages/word-builder.page';
import { ProfileMenu } from './components/profile-menu';
import { HeaderAddButton } from './components/header-add-button';
import { DirectionToggle } from './components/direction-toggle';
import { TranslationAddModal } from './components/translation-add-modal';
import { SelectionAddButton } from './components/selection-add-button';
import { TranslationAddProvider } from './contexts/translation-add.context';

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
          <TranslationAddProvider>
          <div className="flex flex-col h-full">
            <header className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-1 border-b border-black/5 shadow-sm">
              {isLoggedIn && (
                <nav className="flex items-center gap-1">
                  <NavLink
                    to="/"
                    end
                    title="Study"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <BookOpen className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Study</span>
                  </NavLink>
                  <NavLink
                    to="/sentence-training"
                    title="Sentence Training"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <Brain className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Sentence Training</span>
                  </NavLink>
                  <NavLink
                    to="/sentence-construction"
                    title="Sentence Construction"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <PenLine className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Sentence Construction</span>
                  </NavLink>
                  <NavLink
                    to="/sentence-builder"
                    title="Sentence Builder"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <Blocks className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Sentence Builder</span>
                  </NavLink>
                  <NavLink
                    to="/word-builder"
                    title="Word Builder"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <Type className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Word Builder</span>
                  </NavLink>
                </nav>
              )}
              <div className="ml-auto flex items-center gap-1">
                {isLoggedIn && (
                  <NavLink
                    to="/library"
                    title="Library"
                    className={({ isActive }) =>
                      `px-2 md:px-3 py-1 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
                        isActive
                          ? 'text-violet-900 bg-violet-500/12'
                          : 'text-violet-700 hover:text-violet-900 hover:bg-violet-500/8'
                      }`
                    }
                  >
                    <LibraryIcon className="h-4 w-4 md:hidden" />
                    <span className="hidden md:inline">Library</span>
                  </NavLink>
                )}
                {isLoggedIn && <HeaderAddButton />}
                {isLoggedIn && <DirectionToggle />}
                {isLoggedIn && <ProfileMenu />}
                <UserSession
                  isLoggedIn={isLoggedIn}
                  onLoginSuccess={() => setIsLoggedIn(true)}
                  onLogOut={() => setIsLoggedIn(false)}
                  logoutButtonStyle={{
                    color: '#6d28d9',
                    border: '1px solid rgba(124, 58, 237, 0.45)',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderRadius: '0.5rem',
                  }}
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
                  <Route path="/sentence-builder" element={<SentenceBuilderPage />} />
                  <Route path="/word-builder" element={<WordBuilderPage />} />
                </Routes>
              </main>
            )}
          </div>
          {isLoggedIn && <TranslationAddModal />}
          {isLoggedIn && <SelectionAddButton />}
          </TranslationAddProvider>
        </AudioDevicesProvider>
      </GoogleOAuthProvider>
    )
  );
}

export default App;
