import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { removeAuthData } from '../../services/auth-storage.service';

interface IUserSessionProps {
  isLoggedIn: boolean;
  onLoginSuccess: () => void;
  onLogOut: () => void;
}

export const UserSession = ({ isLoggedIn, onLoginSuccess, onLogOut }: IUserSessionProps) => {
  const handleLoginSuccess = (): void => {
    onLoginSuccess();
  };

  const handleLogout = (): void => {
    removeAuthData();
    onLogOut();
  };

  return (
    <div className={css.userSession}>
      {isLoggedIn ? (
        <div className={css.userSessionContent}>
          <h1>Welcome, User!</h1>
          <div>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>
      ) : (
        <SignIn onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};
