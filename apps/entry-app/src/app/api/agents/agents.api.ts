import { utilFetch } from '@lifeis/common-ui';
import { IAgentHistoryResponse, IAgentsResponse, IPinnedAgentsResponse } from '../../domains/agent.domain';

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

export const createTemplate = async (id: string): Promise<void> => {
  const response = await utilFetch(`/agents/${id}/:make-template`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to create agent template');
  }

  return await response.json();
};

export const cloneTemplateAgent = async (id: string): Promise<void> => {
  const response = await utilFetch(`/agents/${id}/:clone`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to create clone of agent template');
  }

  return await response.json();
};
export const updateAgent = async (data: {
  id: string;
  name?: string;
  prefix?: string;
  isArchived?: boolean;
  listenLanguageCode?: string;
  readLanguageCode?: string;
}): Promise<void> => {
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
  imageBuffer,
  aiProvider,
  language,
}: {
  id: string;
  message: string;
  imageBuffer?: string | ArrayBuffer | null;
  aiProvider: string;
  language?: string;
}): Promise<{
  answer: string;
}> => {
  const formData = new FormData();
  formData.append('message', message);
  formData.append('aiProvider', aiProvider);
  if (imageBuffer) {
    formData.append('image', new Blob([imageBuffer]), 'image.png');
  }
  if (language) {
    formData.append('language', language);
  }

  const response = await utilFetch(`/agents/${id}`, {
    method: 'POST',
    body: formData,
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

export const submitImageOnParsing = async (
  imageBuffer: string | ArrayBuffer | null,
): Promise<{
  answer: string;
}> => {
  const formData = new FormData();
  if (imageBuffer) {
    formData.append('image', new Blob([imageBuffer]), 'image.png');
  }

  const response = await utilFetch(`/agents/parse-image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody: RequestError = await response.json();

    throw new Error(errorBody.message);
  }

  return await response.json();
};

export const savePinnedAgents = async (agentsIds: string[]): Promise<IPinnedAgentsResponse> => {
  const response = await utilFetch(`/agents/pinned-agents-ids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agentsIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to update pinned agents');
  }

  return await response.json();
};

export const getPinnedAgents = async (): Promise<IPinnedAgentsResponse> => {
  const response = await utilFetch(`/agents/pinned-agents-ids`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to update pinned agents');
  }

  return await response.json();
};
