import { AuthResponse } from '../domains/auth.domain';

export const getAuthData = (): AuthResponse => {
  return {
    accessToken: localStorage.getItem('accessToken') ?? '',
    refreshToken: localStorage.getItem('refreshToken') ?? '',
  };
};

export const saveAuthData = (data: AuthResponse) => {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
};

export const removeAuthData = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};
