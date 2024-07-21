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

export const getLogs = async (): Promise<ILog[]> => {
  const response = await fetch(`${CONFIG.BE_URL}/api/logs`, {
    headers: {
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
