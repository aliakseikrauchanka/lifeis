interface IAgentBasic {
  _id: string;
  name: string;
  prefix: string;
  type: string;
}

export interface IAgentResponse extends IAgentBasic {
  type: 'agent';
  ownerId: string;
  isArchived?: boolean;
  listenLanguageCode?: string;
  readLanguageCode?: string;
}

export interface IAgentTemplateResponse extends IAgentBasic {
  type: 'template';
  creatorId: string;
}

export interface IAgentsResponse {
  agents: (IAgentResponse | IAgentTemplateResponse)[];
}

export interface IAgentHistoryResponse {
  history: IAgentHistoryItem[];
}

export interface IPinnedAgentsResponse {
  agentsIds: string[];
}

export interface IAgentHistoryItem {
  _id: string;
  agentId: string;
  prefix?: string; // TODO: remove when no longer needed
  message?: string;
  prompt: string;
  response: string;
  timestamp: Date;
}
