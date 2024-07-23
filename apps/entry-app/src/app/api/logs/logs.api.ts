import { utilFetch } from '@lifeis/common-ui';
import { ILog } from '../../domains/log.domain';
import { CONFIG } from '../../../config';

export const createLog = async (message: string): Promise<void> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const getAllLogs = async (): Promise<ILog[]> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/logs`);

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
