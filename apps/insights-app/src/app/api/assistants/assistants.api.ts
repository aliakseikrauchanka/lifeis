import { CONFIG } from '../../../config';

export const checkGrammar = async (text: string): Promise<Response> => {
  const accessToken = localStorage.getItem('accessToken');
  return fetch(`${CONFIG.BE_URL}/check-polish-grammar`, {
    method: 'POST',
    body: JSON.stringify({ text }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
};
