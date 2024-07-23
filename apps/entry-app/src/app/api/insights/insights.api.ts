import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../../../src/config';

export const getAllInsights = async (): Promise<string[]> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/insights`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};
