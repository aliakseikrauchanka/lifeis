import { utilFetch } from '@lifeis/common-ui';
import { IDiaryLog } from '../../domains/log.domain';

export type DescribeFromImageMode = 'get-text' | 'describe-food-ru';

export const describeFromImage = async (
  imageBuffer: ArrayBuffer,
  mode: DescribeFromImageMode = 'describe-food-ru',
): Promise<{ answer: string }> => {
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]), 'image.png');

  const response = await utilFetch(`/agents/parse-image?mode=${mode}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody: { message?: string } = await response.json();
    throw new Error(errorBody.message || 'Failed to describe food from image');
  }

  return response.json();
};

export const deleteLog = async (logId: string): Promise<void> => {
  const response = await utilFetch(`/logs/${logId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete log');
  }
};

export const updateLog = async (logId: string, message: string, basketId?: string): Promise<void> => {
  const body: { message: string; basket_id?: string } = { message };
  if (basketId) {
    body.basket_id = basketId;
  }
  const response = await utilFetch(`/logs/${logId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to update log');
  }
};

export const createLog = async (message: string, basketId?: string): Promise<void> => {
  const body: { message: string; basket_id?: string } = { message };
  if (basketId) {
    body.basket_id = basketId;
  }
  const response = await utilFetch(`/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const getAllLogs = async (from?: Date, to?: Date, basketId?: string): Promise<{ logs?: IDiaryLog[] }> => {
  const urlQueryParameters = new URLSearchParams();
  if (from) {
    urlQueryParameters.append('from', from.toISOString());
  }
  if (to) {
    urlQueryParameters.append('to', to.toISOString());
  }
  if (basketId) {
    urlQueryParameters.append('basket_id', basketId);
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
