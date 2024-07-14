import { getAuthData } from '../../services/local-storage.service';
import { ILog } from '../../domains/log.domain';
import { CONFIG } from '../../../../src/config';

export const createAgent = async (data: { name: string; prefix: string }): Promise<void> => {
  const response = await fetch(`${CONFIG.BE_URL}/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const getAllAgents = async (): Promise<ILog[]> => {
  const response = await fetch(`${CONFIG.BE_URL}/agents`, {
    headers: {
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get agents');
  }

  return await response.json();
};

export const submitMessage = async ({
  id,
  message,
}: {
  id: string;
  message: string;
}): Promise<{
  answer: string;
}> => {
  const response = await fetch(`${CONFIG.BE_URL}/agents/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthData().accessToken}`,
    },
    body: JSON.stringify({
      message,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};
