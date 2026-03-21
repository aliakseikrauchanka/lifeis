import { utilFetch } from '@lifeis/common-ui';

export const askLogsChat = async (
  question: string,
  params: { from?: string; to?: string; basketId?: string }
): Promise<{ answer: string }> => {
  const body: { question: string; from?: string; to?: string; basket_id?: string } = { question };
  if (params.from) body.from = params.from;
  if (params.to) body.to = params.to;
  if (params.basketId) body.basket_id = params.basketId;

  const response = await utilFetch('/logs/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody: { message?: string } = await response.json();
    throw new Error(errorBody.message || 'Failed to get answer');
  }

  return response.json();
};
