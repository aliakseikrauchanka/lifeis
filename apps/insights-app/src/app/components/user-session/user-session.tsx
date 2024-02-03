import React, { useState } from 'react';
import SignIn from '../../pages/sign-in';

import css from './user-session.module.scss';

interface IUserState {
  accessToken: string;
  refreshToken: string;
}

export const UserSession = () => {
  const [user, setUser] = useState<IUserState | null>({
    accessToken: localStorage.getItem('accessToken') ?? '',
    refreshToken: localStorage.getItem('refreshToken') ?? '',
  });

  const handleLoginSuccess = (tokens: any) => {
    // Assuming tokens contain user details and the access token
    setUser({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    // Optionally, you might want to store the access token in local storage for persistence
    localStorage.setItem('accessToken', tokens.access_token);
    localStorage.setItem('refreshToken', tokens.refresh_token);
  };

  const handleLogout = () => {
    // Clear the user session and tokens
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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
