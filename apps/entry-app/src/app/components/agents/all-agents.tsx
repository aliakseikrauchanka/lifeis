import { getAllAgents } from '../../api/agents/agents.api';
import React, { useEffect, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useQuery } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';
import { useStorageContext } from '../../contexts/storage.context';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/joy';
import classNames from 'classnames';

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

  const agents = query.data.filter((agent) => agent.type === 'agent' || !agent.type);
  const nonArchivedAgents = agents.filter((agent) => !agent.isArchived);
  const archivedAgents = agents.filter((agent) => !!agent.isArchived);

  const pinnedAgents = pinnedAgentsIds
    .map((id) => nonArchivedAgents.find((agent) => agent._id === id))
    .filter((agent) => !!agent) as IAgentResponse[]; // TODO: ???
  const nonPinnedAgents = nonArchivedAgents.filter((agent) => !pinnedAgentsIds.includes(agent._id));
  const sortedAgents = [...pinnedAgents, ...nonPinnedAgents];

  const agentTemplates = query.data.filter((agent) => agent.type === 'template');

  return (
    <div>
      <div className={css.agentsWrapper}>
        <div className={css.agents}>
          {sortedAgents.map((agent, i: number) => (
            <Agent
              type="agent"
              id={agent._id}
              userId={agent.ownerId}
              name={agent.name}
              prefix={agent.prefix}
              key={agent._id}
              number={AVAILABLE_KEYS.includes(String(i + 1)) ? i + 1 : undefined}
              focused={i === focusedAgentIndex}
              isArchived={!!agent.isArchived}
            />
          ))}
        </div>

        <AgentForm />

        <br />
        <Accordion>
          <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
            <h3>Your archived agents:</h3>
          </AccordionSummary>
          <AccordionDetails>
            <div className={classNames(css.agentsArchived, css.agents)}>
              {archivedAgents.map((agent, i: number) => (
                <Agent
                  type="agent"
                  id={agent._id}
                  userId={agent.ownerId}
                  name={agent.name}
                  prefix={agent.prefix}
                  key={agent._id}
                  isArchived={agent.isArchived}
                />
              ))}
            </div>
          </AccordionDetails>
        </Accordion>
        <br />
        <Accordion>
          <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
            <h3>Template agents</h3>
          </AccordionSummary>
          <AccordionDetails>
            <div className={css.agents}>
              {agentTemplates.map((agent, i: number) => (
                <Agent
                  type="template"
                  id={agent._id}
                  userId={agent.creatorId}
                  name={agent.name}
                  prefix={agent.prefix}
                  key={agent._id}
                />
              ))}
            </div>
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  );
};
