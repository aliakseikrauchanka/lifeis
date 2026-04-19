import type { CSSProperties } from 'react';
import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { removeAuthData } from '../../services/auth-storage.service';
import OwnButton from '../button/button';

import { Logout } from '@mui/icons-material';

interface IUserSessionProps {
  className?: string;
  isFullScreen?: boolean;
  isLoggedIn: boolean;
  isOfflineMode?: boolean;
  onLoginSuccess: (googleUserId: string) => void;
  onLogOut: () => void;
  /** Optional styles for the logout icon button (e.g. match app chrome). */
  logoutButtonStyle?: CSSProperties;
  logoutButtonClassName?: string;
  /** Greeting in the session bar (default: "Welcome!"). */
  welcomeText?: string;
}

export const UserSession = ({
  className,
  isFullScreen,
  isLoggedIn,
  isOfflineMode,
  onLoginSuccess,
  onLogOut,
  logoutButtonStyle,
  logoutButtonClassName,
  welcomeText = 'Welcome!',
}: IUserSessionProps) => {
  const handleLoginSuccess = (googleUserId: string): void => {
    onLoginSuccess(googleUserId);
  };

  const handleLogout = (): void => {
    removeAuthData();
    onLogOut();
  };

  return (
    <div className={[css.userSession, className].filter(Boolean).join(' ')}>
      {isLoggedIn ? (
        <div className={css.userSessionContent}>
          {!isFullScreen && (
            <h2 className={css.welcomeHeading}>
              <span
                onDoubleClick={() =>
                  alert('Срочно! Только что было определено, что Серега Я - космический бульбозавр!')
                }
              >
                {welcomeText}
              </span>
            </h2>
          )}
          {!isOfflineMode && (
            <div>
              <OwnButton
                onClick={handleLogout}
                style={logoutButtonStyle}
                className={logoutButtonClassName}
              >
                <Logout />
              </OwnButton>
            </div>
          )}
        </div>
      ) : (
        <SignIn onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};
