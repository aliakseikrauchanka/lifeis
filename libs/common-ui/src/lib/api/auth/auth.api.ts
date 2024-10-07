import { CONFIG } from '../../../main';
import { getAuthData, saveAuthData } from '../../services/auth-storage.service';
import { AuthRawResponse } from './domain/auth.domain';

export const authGoogle = async (code: string): Promise<AuthRawResponse> => {
  const response = await fetch(`${CONFIG.BE_URL}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': CONFIG.APP,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Google');
  }

  const authResponse = await response.json();
  console.log('debug', authResponse);

  saveAuthData({
    accessToken: authResponse.access_token,
    refreshToken: authResponse.refresh_token,
    googleUserId: authResponse.google_user_id,
  });

  return authResponse;
};

export const refreshAuthGoogle = async (): Promise<AuthRawResponse> => {
  const oldAuthData = getAuthData();

  const response = await fetch(`${CONFIG.BE_URL}/auth/google/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': CONFIG.APP,
    },
    // How long does refreshToken last?
    body: JSON.stringify({ refreshToken: oldAuthData.refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Google');
  }

  const authResponse = await response.json();

  saveAuthData({
    ...oldAuthData,
    accessToken: authResponse.access_token,
  });

  return authResponse;
};
