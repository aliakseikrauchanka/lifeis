import { CONFIG } from '../../../main';
import { getAuthData, saveAuthData } from '../../services/auth-storage.service';
import { AuthRawResponse } from './domain/auth.domain';

export const authGoogle = async (code: string): Promise<AuthRawResponse> => {
  const response = await fetch(`${CONFIG.BE_URL}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Google');
  }

  const authResponse = await response.json();

  saveAuthData({
    accessToken: authResponse.access_token,
    refreshToken: authResponse.refresh_token,
  });

  return authResponse;
};

export const refreshAuthGoogle = async (): Promise<AuthRawResponse> => {
  const oldTokens = getAuthData();

  const response = await fetch(`${CONFIG.BE_URL}/auth/google/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // How long does refreshToken last?
    body: JSON.stringify({ refreshToken: oldTokens.refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Google');
  }

  const authResponse = await response.json();

  saveAuthData({
    ...oldTokens,
    accessToken: authResponse.access_token,
  });

  return authResponse;
};
