import { useState } from 'react';
import { SignIn } from './components/sign-in';

import css from './user-session.module.scss';
import { AuthResponse } from '../../domains/auth.domain';
import { IUserState } from '../../domains/user.domain';
import { getAuthData, removeAuthData, saveAuthData } from '../../services/local-storage.service';
import { refreshAuthGoogle } from '../../api/auth/auth';
import OwnButton from '../button/button';
import { CONFIG } from '../../config';

export const UserSession = () => {
  const [user, setUser] = useState<IUserState>(getAuthData());

  const handleLoginSuccess = (response: AuthResponse): void => {
    setUser({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    saveAuthData(response);
  };

  const handleLogout = (): void => {
    removeAuthData();
    setUser(getAuthData());
  };

  const handleRefresh = async () => {
    const authResponse = await refreshAuthGoogle(String(user?.refreshToken));

    const authData = {
      ...user,
      accessToken: authResponse.access_token,
    };

    setUser(authData);
    saveAuthData(authData);
  };

  // TODO: refactor
  const handleBEPing = async () => {
    const accessToken = localStorage.getItem('accessToken');
    try {
      await fetch(`${CONFIG.BE_URL}/ping`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (e) {
      console.log('error happened during fetch');
    }
  };

  return (
    <div>
      {user?.accessToken && user?.refreshToken ? (
        <div className={css.userSession}>
          <h1>Welcome, User!</h1>
          <div>
            <button onClick={handleLogout}>Logout</button>
            <button onClick={handleRefresh}>Refresh</button>
            <OwnButton onClick={handleBEPing}>Ping BE</OwnButton>
          </div>
        </div>
      ) : (
        <SignIn onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};
