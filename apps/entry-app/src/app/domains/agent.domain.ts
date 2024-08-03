export interface IAgentResponse {
  _id: string;
  name: string;
  prefix: string;
  ownerId: string;
}

export interface IAgentsResponse {
  agents: IAgentResponse[];
}
