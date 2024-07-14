import { getAllAgents } from '../../api/agents/agents';
import React, { useEffect, useState } from 'react';
import { Agent } from './agent';
import AgentForm from './agent-form';

export const AllAgents = () => {
  const [agents, setAgents] = useState([]);

  const getAgents = async () => {
    const response = await getAllAgents();
    const agents = (response as any).agents;
    setAgents(agents);
  };

  useEffect(() => {
    getAgents();
  }, []);

  const handleCreate = () => {
    getAgents();
  };

  return (
    <div>
      <h1>AllAgents</h1>
      <AgentForm onCreate={handleCreate} />

      {!!agents.length && (
        <ul>
          {agents.map((agent: any) => (
            // TODO: get rid of any type
            <li id={agent._id}>
              <Agent id={agent._id} name={agent.name} key={agent._id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
