import { refreshAuthGoogle } from '../api/auth/auth.api';
import { getAuthData } from '../services/auth-storage.service';

export const utilFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const oldTokens = getAuthData();

  const response = await fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${oldTokens.accessToken}`,
    },
  });

  if (response.status === 401) {
    const authResponse = await refreshAuthGoogle();

    return await fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${authResponse.access_token}`,
      },
    });
  }

  return response;
};
