import { AuthResponse } from '../domains/auth.domain';

const localStorage = window.localStorage;

export const getAuthData = (): AuthResponse => {
  return {
    accessToken: localStorage.getItem('accessToken') ?? '',
    refreshToken: localStorage.getItem('refreshToken') ?? '',
    googleUserId: localStorage.getItem('googleUserId') ?? '',
  };
};

export const saveAuthData = (data: AuthResponse) => {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('googleUserId', data.googleUserId);
};

export const removeAuthData = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('googleUserId');
};

export const isUserLoggedIn = (): boolean => {
  const authData = getAuthData();
  return !!authData.accessToken && !!authData.refreshToken;
};

export const getGoogleUserId = (): string => {
  const authData = getAuthData();
  return authData.googleUserId;
};
