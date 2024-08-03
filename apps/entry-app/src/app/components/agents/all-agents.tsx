import { getAllAgents } from '../../api/agents/agents.api';
import React, { useEffect, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useQuery } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';

const AVAILABLE_KEYS = ['1', '2', '3', '4'];

export const AllAgents = () => {
  const query = useQuery({ queryKey: ['agents'], queryFn: getAllAgents, select: (data) => data.agents });

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

  return (
    <div>
      <div className={css.agentsWrapper}>
        <h2>agents</h2>
        {!!query.data?.length && (
          <div className={css.agents}>
            {query.data?.map((agent: IAgentResponse, i: number) => (
              // TODO: get rid of any type
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
        )}
      </div>
      <AgentForm />
    </div>
  );
};
