import { utilFetch } from '@lifeis/common-ui';
import { IAgentHistoryResponse, IAgentsResponse } from '../../domains/agent.domain';

export const createAgent = async (data: { name: string; prefix: string }): Promise<void> => {
  const response = await utilFetch(`/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create agent');
  }

  return await response.json();
};

export const updateAgent = async (data: { id: string; name: string; prefix: string }): Promise<void> => {
  const response = await utilFetch(`/agents/${data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update agent');
  }

  return await response.json();
};

export const removeAgent = async (id: string): Promise<void> => {
  const response = await utilFetch(`/agents/${id}`, {
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
  const response = await utilFetch(`/agents`);

  if (!response.ok) {
    throw new Error('Failed to get agents');
  }

  return await response.json();
};

export const submitMessage = async ({
  id,
  message,
  aiProvider,
}: {
  id: string;
  message: string;
  aiProvider: string;
}): Promise<{
  answer: string;
}> => {
  const response = await utilFetch(`/agents/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      aiProvider,
    }),
  });

  if (!response.ok) {
    const errorBody: RequestError = await response.json();
    throw new Error(errorBody.message);
  }

  return await response.json();
};

export const getAgentHistory = async (agentId: string): Promise<IAgentHistoryResponse> => {
  const response = await utilFetch(`/agents/${agentId}/history`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to create log');
  }

  return await response.json();
};
