import { getAllAgents, updateAgent } from '../api/agents/agents.api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Agent, IAgentHandle } from '../components/agents/agent/agent';
import AgentForm from '../components/agents/agent-create/agent-create';
import css from '../components/agents/all-agents.module.scss';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IAgentResponse } from '../domains/agent.domain';
import { useStorageContext } from '../contexts/storage.context';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/joy';
import classNames from 'classnames';
import { AgentSearch } from '../components/agents/agent-search/agent-search';
import { SelectionContextMenu } from '../components/agents/selection-context-menu/selection-context-menu';

const AVAILABLE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const AllAgentsPage = () => {
  const query = useQuery({ queryKey: ['agents'], queryFn: getAllAgents, select: (data) => data.agents });

  const agentsRef = useRef<Record<string, IAgentHandle>>({});

  const queryClient = useQueryClient();

  const {
    pinnedAgentsIds,
    languageCode,
    setLanguageCode,
    isSearchOpened,
    setIsSearchOpened,
    setFocusedAgentIndex,
    focusedAgentIndex,
  } = useStorageContext();

  const agents: IAgentResponse[] = query.data?.filter((agent) => agent.type === 'agent' || !agent.type) ?? [];
  const nonArchivedAgents = agents.filter((agent) => !agent.isArchived);
  const archivedAgents = agents.filter((agent) => !!agent.isArchived);

  const pinnedAgents = pinnedAgentsIds
    .map((id) => nonArchivedAgents.find((agent) => agent._id === id))
    .filter((agent) => !!agent) as IAgentResponse[]; // TODO: ???
  const nonPinnedAgents = nonArchivedAgents.filter((agent) => !pinnedAgentsIds.includes(agent._id));
  const sortedAgents = useMemo(() => [...pinnedAgents, ...nonPinnedAgents], [pinnedAgents, nonPinnedAgents]);

  const agentTemplates = query.data?.filter((agent) => agent.type === 'template') ?? [];

  // Inside your component:
  // const [isSearchOpen, setIsSearchOpen] = useState(false);

  const focusedAgentId = useMemo(() => {
    return sortedAgents[focusedAgentIndex]?._id || '';
  }, [sortedAgents, focusedAgentIndex]);

  const focusAgent = useCallback(
    (index: number) => {
      setFocusedAgentIndex(-1);
      if (!!sortedAgents[index]?.listenLanguageCode && sortedAgents[index]?.listenLanguageCode !== languageCode) {
        setLanguageCode(sortedAgents[index]?.listenLanguageCode);
      }
      setTimeout(() => {
        setFocusedAgentIndex(index);
      }, 100);
    },
    [setFocusedAgentIndex, setLanguageCode, languageCode, sortedAgents],
  );

  const handleAgentSelect = (agentId: string) => {
    focusAgent(sortedAgents.findIndex((agent) => agent._id === agentId));
  };

  const updateMutation = useMutation({
    mutationFn: updateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleReadLanguageChange = useCallback(
    (event: any, newValue: string | null) => {
      const focusedAgent = sortedAgents.find((agent) => agent._id === focusedAgentId);
      if (!focusedAgent) {
        return;
      }
      const { _id: id, name, prefix } = focusedAgent;
      updateMutation.mutate({ id, name, prefix, readLanguageCode: newValue || '' });
    },
    [focusedAgentId, sortedAgents, updateMutation],
  );

  useEffect(() => {
    const handleFocus = () => {
      focusAgent(focusedAgentIndex);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [focusedAgentIndex, focusAgent]);

  // Add keyboard shortcut to open search
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsSearchOpened((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    if (!query.data?.length) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.metaKey && AVAILABLE_KEYS.includes(event.key)) {
        const index = parseInt(event.key) - 1;
        if (index < query.data?.length) {
          focusAgent(index);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [query.data?.length, focusAgent]);

  // array of agents where pinnedAgents are first and then the rest but that need to save the order of the pinned agents
  // order of pinned agents should be saved

  const [expandedAccordions, setExpandedAccordions] = useState<{
    archived: boolean;
    templates: boolean;
  }>({
    archived: false,
    templates: false,
  });

  const handleAccordionChange =
    (accordion: 'archived' | 'templates') => (event: React.SyntheticEvent, expanded: boolean) => {
      setExpandedAccordions((prev) => ({
        ...prev,
        [accordion]: expanded,
      }));
    };

  const handleSubmitToAgent = useCallback(
    (agentIndex: number, text: string) => {
      const selectedAgent = sortedAgents[agentIndex];
      if (!selectedAgent) return;

      setFocusedAgentIndex(agentIndex);

      const agentRef = agentsRef.current[selectedAgent._id];
      if (!agentRef) return;

      agentRef.setNewMessage(text);
    },
    [sortedAgents, setFocusedAgentIndex],
  );

  const handleFocusAgent = useCallback(
    (index: number) => {
      return () => focusAgent(index);
    },
    [focusAgent],
  );

  if (!query.data) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {isSearchOpened && (
        <AgentSearch agents={sortedAgents} onSelect={handleAgentSelect} onClose={() => setIsSearchOpened(false)} />
      )}
      <div>
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
              onAgentFocus={handleFocusAgent(i)}
              isArchived={!!agent.isArchived}
              listenLanguageCode={agent.listenLanguageCode}
              readLanguageCode={agent.readLanguageCode}
              ref={(el: IAgentHandle) => {
                if (el) {
                  agentsRef.current[agent._id] = el;
                }
              }}
            />
          ))}
        </div>

        <AgentForm />

        <SelectionContextMenu
          agents={sortedAgents}
          focusedAgentId={focusedAgentId}
          languageCode={languageCode}
          onReadLanguageChange={handleReadLanguageChange}
          onSubmitToAgent={handleSubmitToAgent}
          selectedAgentIndex={focusedAgentIndex}
        />

        <br />
        <Accordion expanded={expandedAccordions.archived} onChange={handleAccordionChange('archived')}>
          <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
            <h3>Your archived agents:</h3>
          </AccordionSummary>
          <AccordionDetails>
            {expandedAccordions.archived && (
              <div className={classNames(css.agentsArchived, css.agents)}>
                {archivedAgents.map((agent) => (
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
            )}
          </AccordionDetails>
        </Accordion>
        <br />
        <Accordion expanded={expandedAccordions.templates} onChange={handleAccordionChange('templates')}>
          <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
            <h3>Template agents</h3>
          </AccordionSummary>
          <AccordionDetails>
            {expandedAccordions.templates && (
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
            )}
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  );
};
