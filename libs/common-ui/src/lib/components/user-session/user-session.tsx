import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { removeAuthData } from '../../services/auth-storage.service';
import OwnButton from '../button/button';

interface IUserSessionProps {
  isLoggedIn: boolean;
  isOfflineMode?: boolean;
  onLoginSuccess: (googleUserId: string) => void;
  onLogOut: () => void;
}

export const UserSession = ({ isLoggedIn, isOfflineMode, onLoginSuccess, onLogOut }: IUserSessionProps) => {
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
          <h2>
            Welcome,{' '}
            <span onClick={() => alert('Срочно! Только что было определено, что Серега Я - космический бульбозавт')}>
              User
            </span>
            !
          </h2>
          {!isOfflineMode && (
            <div>
              <OwnButton onClick={handleLogout}>Logout</OwnButton>
            </div>
          )}
        </div>
      ) : (
        <SignIn onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};
