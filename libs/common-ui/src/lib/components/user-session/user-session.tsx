import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { removeAuthData } from '../../services/auth-storage.service';
import OwnButton from '../button/button';

import { Logout } from '@mui/icons-material';

interface IUserSessionProps {
  isFullScreen?: boolean;
  isLoggedIn: boolean;
  isOfflineMode?: boolean;
  onLoginSuccess: (googleUserId: string) => void;
  onLogOut: () => void;
}

export const UserSession = ({
  isFullScreen,
  isLoggedIn,
  isOfflineMode,
  onLoginSuccess,
  onLogOut,
}: IUserSessionProps) => {
  const handleLoginSuccess = (googleUserId: string): void => {
    onLoginSuccess(googleUserId);
  };

  const handleLogout = (): void => {
    removeAuthData();
    onLogOut();
  };

  return (
    <div className={css.userSession}>
      {isLoggedIn ? (
        <div className={css.userSessionContent}>
          {!isFullScreen && (
            <h2>
              <span
                onDoubleClick={() =>
                  alert('Срочно! Только что было определено, что Серега Я - космический бульбозавр!')
                }
              >
                Velkommen!
              </span>
            </h2>
          )}
          {!isOfflineMode && (
            <div>
              <OwnButton onClick={handleLogout}>
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
