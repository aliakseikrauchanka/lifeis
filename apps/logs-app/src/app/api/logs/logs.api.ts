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

export const getAllLogs = async (from?: Date): Promise<IDiaryLog[]> => {
  const urlQueryParameters = new URLSearchParams();
  if (from) {
    urlQueryParameters.append('from', from.toISOString());
  }

  const url = `/logs?${urlQueryParameters.toString()}`;

  const response = await utilFetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
