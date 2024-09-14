import { getAllAgents } from '../../api/agents/agents.api';
import React, { useEffect, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useQuery } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';
import { useStorageContext } from '../../contexts/storage.context';

const AVAILABLE_KEYS = ['1', '2', '3', '4'];

export const AllAgents = () => {
  const query = useQuery({ queryKey: ['agents'], queryFn: getAllAgents, select: (data) => data.agents });

  const { pinnedAgentsIds } = useStorageContext();

  const [focusedAgentIndex, setFocusedAgentIndex] = useState(0);

  useEffect(() => {
    if (!query.data?.length) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.metaKey && AVAILABLE_KEYS.includes(event.key)) {
        const index = parseInt(event.key) - 1;
        if (index < query.data?.length) {
          setFocusedAgentIndex(index);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [query.data?.length]);

  // array of agents where pinnedAgents are first and then the rest but that need to save the order of the pinned agents
  // order of pinned agents should be saved

  if (!query.data) {
    return <div>Loading...</div>;
  }

  const pinnedAgents = pinnedAgentsIds
    .map((id) => query.data.find((agent) => agent._id === id))
    .filter((agent) => !!agent) as IAgentResponse[]; // TODO: ???
  const nonPinnedAgents = query.data.filter((agent) => !pinnedAgentsIds.includes(agent._id));
  const sortedAgents = [...pinnedAgents, ...nonPinnedAgents];

  return (
    <div>
      <div className={css.agentsWrapper}>
        <h2>agents</h2>
        <div className={css.agents}>
          {sortedAgents.map((agent: IAgentResponse, i: number) => (
            <Agent
              id={agent._id}
              name={agent.name}
              prefix={agent.prefix}
              key={agent._id}
              number={AVAILABLE_KEYS.includes(String(i + 1)) ? i + 1 : undefined}
              focused={i === focusedAgentIndex}
            />
          ))}
        </div>
      </div>
      <AgentForm />
    </div>
  );
};
