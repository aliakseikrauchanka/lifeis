import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../../config';
import { IAgentHistoryItem, IAgentHistoryResponse, IAgentsResponse } from '../../domains/agent.domain';

export const createAgent = async (data: { name: string; prefix: string }): Promise<void> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const updateAgent = async (data: { id: string; name: string; prefix: string }): Promise<void> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/agents/${data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};

export const removeAgent = async (id: string): Promise<void> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/agents/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to remove agent');
  }

  return await response.json();
};

export const getAllAgents = async (): Promise<IAgentsResponse> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/agents`);

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
  const response = await utilFetch(`${CONFIG.BE_URL}/agents/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

export const getAgentHistory = async (agentId: string): Promise<IAgentHistoryResponse> => {
  const response = await utilFetch(`${CONFIG.BE_URL}/agents/${agentId}/history`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};
