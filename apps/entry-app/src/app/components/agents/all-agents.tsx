import { getAllAgents } from '../../api/agents/agents';
import React, { useEffect, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';

const AVAILABLE_KEYS = ['1', '2', '3', '4'];

export const AllAgents = () => {
  const [agents, setAgents] = useState([]);

  const getAgents = async () => {
    const response = await getAllAgents();
    const agents = (response as any).agents;
    setAgents(agents);
  };

  const [focusedAgentIndex, setFocusedAgentIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.metaKey && AVAILABLE_KEYS.includes(event.key)) {
        const index = parseInt(event.key) - 1;
        if (index < agents.length) {
          setFocusedAgentIndex(index);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [agents.length]);

  useEffect(() => {
    getAgents();
  }, []);

  const handleCreate = () => {
    getAgents();
  };

  const handleOnAgentRemove = () => {
    getAgents();
  };

  return (
    <div>
      <div className={css.agentsWrapper}>
        <h2>agents</h2>
        {!!agents.length && (
          <div className={css.agents}>
            {agents.map((agent: any, i: number) => (
              // TODO: get rid of any type
              <Agent
                id={agent._id}
                name={agent.name}
                prefix={agent.prefix}
                key={agent._id}
                onRemove={handleOnAgentRemove}
                number={AVAILABLE_KEYS.includes(String(i + 1)) ? i + 1 : undefined}
                focused={i === focusedAgentIndex}
              />
            ))}
          </div>
        )}
      </div>
      <AgentForm onCreate={handleCreate} />
    </div>
  );
};
