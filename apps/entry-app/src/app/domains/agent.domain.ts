export interface IAgentResponse {
  _id: string;
  name: string;
  prefix: string;
  ownerId: string;
}

export interface IAgentsResponse {
  agents: IAgentResponse[];
}

export interface IAgentHistory {
  _id: string;
  agentId: string;
  prompt: string;
  response: string;
  timestamp: Date;
}
