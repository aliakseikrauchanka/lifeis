import { refreshAuthGoogle } from '../api/auth/auth.api';
import { getAuthData } from '../services/auth-storage.service';
import { CONFIG } from '../../main';

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export const utilFetch = async (path: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const beUrl = `${CONFIG.BE_URL}${path}`;
  const oldAuthTokens = getAuthData();

  const response = await fetch(beUrl, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: !isOfflineModeOn ? `Bearer ${oldAuthTokens.accessToken}` : '',
      'x-app-id': CONFIG.APP,
    },
  });

  if (response.status === 401) {
    const authResponse = await refreshAuthGoogle();

    return await fetch(beUrl, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: !isOfflineModeOn ? `Bearer ${authResponse.access_token}` : '',
        'x-app-id': CONFIG.APP,
      },
    });
  }

  return response;
};
