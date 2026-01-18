import { getAllAgents, updateAgent } from '../../api/agents/agents.api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Agent, IAgentHandle } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';
import { useStorageContext } from '../../contexts/storage.context';
import { Accordion, AccordionDetails, AccordionSummary, Select, Option } from '@mui/joy';
import classNames from 'classnames';
import { AgentSearch } from './agent-search/agent-search';
import { LanguageSelector, OwnButton } from '@lifeis/common-ui';
import { speak } from './all-agents.helpers';

const AVAILABLE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const AllAgents = () => {
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

  const audioRef = useRef<HTMLAudioElement>(null);

  const [selectedAgentIndex, setSelectedAgentIndex] = useState<number>(0);

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

  useEffect(() => {
    if (focusedAgentIndex >= 0) {
      setSelectedAgentIndex(focusedAgentIndex);
    }
  }, [focusedAgentIndex, setSelectedAgentIndex]);

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

  const [selectionRect, setSelectionRect] = useState<any>(null);
  const [selectionText, setSelectionText] = useState('');
  const textRef = useRef(null);
  const [curAudioBase64, setCurAudioBase64] = useState('');
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

  useEffect(() => {
    const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

    if (isIPad) return;

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    // get text from selection
    const text = selection.toString();

    if (
      range &&
      !selection.isCollapsed &&
      !!range.commonAncestorContainer.parentElement?.closest('.response-body') &&
      text.length < 200 // limit to 200 characters
    ) {
      const containerRect = (textRef.current as any).getBoundingClientRect();

      const rect = range.getBoundingClientRect();
      setSelectionRect({
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height,
      });

      setSelectionText(text);
    } else {
      setTimeout(() => {
        setSelectionRect(null);
        setSelectionText('');
      }, 100);
      setCurAudioBase64('');
      audioRef.current?.pause();
    }
  };

  const handleSelectedAgentChange = useCallback(
    (event: any, newValue: string | null) => {
      if (!newValue) {
        return;
      }
      const selectedAgentIndex = Number(newValue) || 0;
      const selectedAgent = sortedAgents[selectedAgentIndex];
      if (!selectedAgent) {
        return;
      }

      setFocusedAgentIndex(selectedAgentIndex);

      const agentRef = agentsRef.current[selectedAgent._id];
      if (!agentRef) return;

      agentRef.setNewMessage(selectionText);
    },
    [sortedAgents, selectionText, setFocusedAgentIndex],
  );

  const handleSetNewMessage = useCallback(() => {
    const agentRef = agentsRef.current[focusedAgentId];
    if (!agentRef) return;

    agentRef.setNewMessage(selectionText);
  }, [agentsRef, focusedAgentId, selectionText]);

  const handleFocusAgent = useCallback(
    (index: number) => {
      return () => focusAgent(index);
    },
    [focusAgent],
  );

  const handleSpeak = useCallback(async () => {
    const language = sortedAgents.find((a) => a._id === focusedAgentId)?.readLanguageCode || languageCode;
    speak(selectionText, language, (audioUrl) => {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();

        // Cleanup
        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
      }
    });
  }, [selectionText, sortedAgents, focusedAgentId, languageCode]);

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

        <div style={{ position: 'relative', padding: '20px' }} ref={textRef}>
          {selectionRect && (
            <div
              className={css.agentsMenu}
              style={{
                top: selectionRect.top + selectionRect.height + 10, // TODO: Adjust as needed
                left: selectionRect.left,
              }}
            >
              <div className={css.agentsMenuItem}>
                <OwnButton onClick={handleSpeak}>Speak</OwnButton>
                <div
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <LanguageSelector
                    languageCode={sortedAgents.find((a) => a._id === focusedAgentId)?.readLanguageCode || languageCode}
                    sx={{ minWidth: '20px' }}
                    handleLanguageChange={handleReadLanguageChange}
                  />
                </div>
              </div>
              <div className={css.agentsMenuItem}>
                <OwnButton onClick={handleSetNewMessage}>Submit</OwnButton>
                <Select
                  value={String(selectedAgentIndex)}
                  onChange={handleSelectedAgentChange}
                  sx={{ minWidth: 120, minHeight: '1.75rem' }}
                >
                  {sortedAgents.map((agent, i) => {
                    return <Option value={String(i)}>{agent.name}</Option>;
                  })}
                </Select>
              </div>

              {/* <button
                onClick={() => {
                  audioRef.current?.pause();
                }}
              >
                Stop
              </button> */}
              <audio ref={audioRef}>
                <source type="audio/mpeg" />
              </audio>
            </div>
          )}
        </div>

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
