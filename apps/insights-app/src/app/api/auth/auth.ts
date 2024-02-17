import { CONFIG } from '../../../config';
import { AuthRawResponse } from './auth.domain';

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

  return await response.json();
};
