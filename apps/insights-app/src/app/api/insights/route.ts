import { utilFetch } from '@lifeis/common-ui';

export const GET = async (): Promise<string[]> => {
  const response = await utilFetch(`/insights`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
