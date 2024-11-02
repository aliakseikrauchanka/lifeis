import { utilFetch } from '@lifeis/common-ui';
import { IDiaryLog } from '../../domains/log.domain';

export const createLog = async (message: string): Promise<void> => {
  const response = await utilFetch(`/logs`, {
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

export const getAllLogs = async <T>(): Promise<IDiaryLog[]> => {
  const response = await utilFetch(`/logs`);

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
