export interface IAgentResponse {
  _id: string;
  name: string;
  prefix: string;
  ownerId: string;
}

export interface IAgentsResponse {
  agents: IAgentResponse[];
}

export interface IAgentHistoryResponse {
  history: IAgentHistoryItem[];
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
