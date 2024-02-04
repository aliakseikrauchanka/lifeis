import React, { useState } from 'react';
import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { AuthResponse } from '../../domains/auth.domain';
import { IUserState } from '../../domains/user.domain';
import {
  getAuthData,
  removeAuthData,
  saveAuthData,
} from '../../services/local-storage.service';

export const UserSession = () => {
  const [user, setUser] = useState<IUserState | null>(getAuthData());

  const handleLoginSuccess = (response: AuthResponse): void => {
    setUser({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    saveAuthData(response);
  };

  const handleLogout = (): void => {
    setUser(null);
    removeAuthData();
  };

  return (
    <div>
      {user?.accessToken && user?.refreshToken ? (
        <div className={css.userSession}>
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
