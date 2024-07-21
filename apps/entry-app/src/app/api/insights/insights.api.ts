import { getAuthData } from '@lifeis/common-ui';
import { ILog } from '../../domains/log.domain';
import { CONFIG } from '../../../../src/config';

export const createLog = async (message: string): Promise<void> => {
  const response = await fetch(`${CONFIG.BE_URL}/api/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const getInsights = async (): Promise<ILog[]> => {
  const response = await fetch(`${CONFIG.BE_URL}/api/insights`, {
    headers: {
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get insights');
  }

  return await response.json();
};
