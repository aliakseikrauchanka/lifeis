import { utilFetch } from '@lifeis/common-ui';

export const createBasket = async (name: string): Promise<void> => {
  const response = await utilFetch(`/baskets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

interface IBasket {
  _id?: string;
  name: string;
}

export const getAllBaskets = async <T>(): Promise<IBasket[]> => {
  const response = await utilFetch(`/baskets`);

  if (!response.ok) {
    throw new Error('Failed to get logs');
  }

  return await response.json();
};
