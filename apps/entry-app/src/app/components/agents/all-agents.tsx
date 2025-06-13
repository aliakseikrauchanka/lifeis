import { getAllAgents, updateAgent } from '../../api/agents/agents.api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';
import { useStorageContext } from '../../contexts/storage.context';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/joy';
import classNames from 'classnames';
import { AgentSearch } from './agent-search/agent-search';
import { LanguageSelector, OwnButton } from '@lifeis/common-ui';
import { speak } from './all-agents.helpers';

const AVAILABLE_KEYS = ['1', '2', '3', '4', '5'];

export const AllAgents = () => {
  const query = useQuery({ queryKey: ['agents'], queryFn: getAllAgents, select: (data) => data.agents });

  const queryClient = useQueryClient();

  const { pinnedAgentsIds, languageCode } = useStorageContext();

  const [focusedAgentIndex, setFocusedAgentIndex] = useState(0);
  const [focusedAgentId, setFocusedAgentId] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleAgentSelect = (agentId: string) => {
    setFocusedAgentIndex(sortedAgents.findIndex((agent) => agent._id === agentId));
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

  // Add keyboard shortcut to open search
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
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

  const [selectionRect, setSelectionRect] = useState<any>(null);
  const [selectionText, setSelectionText] = useState('');
  const textRef = useRef(null);
  const [curAudioBase64, setCurAudioBase64] = useState('');

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
      }, 50);
      setSelectionText('');
      setCurAudioBase64('');
      audioRef.current?.pause();
    }
  };

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
      {isSearchOpen && (
        <AgentSearch agents={sortedAgents} onSelect={handleAgentSelect} onClose={() => setIsSearchOpen(false)} />
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
              onBlur={() => setFocusedAgentIndex(-1)}
              onAgentFocus={() => setFocusedAgentId(agent._id)}
              isArchived={!!agent.isArchived}
              listenLanguageCode={agent.listenLanguageCode}
              readLanguageCode={agent.readLanguageCode}
            />
          ))}
        </div>

        <AgentForm />

        <div style={{ position: 'relative', padding: '20px' }} ref={textRef}>
          {selectionRect && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                position: 'absolute',
                top: selectionRect.top + selectionRect.height + 10, // TODO: Adjust as needed
                left: selectionRect.left,
                backgroundColor: 'rebeccapurple',
                // height: selectionRect.height,
                overflow: 'hidden',
                zIndex: 1000,
                fontSize: '13px',
                color: 'white',
              }}
            >
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
        <Accordion>
          <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
            <h3>Your archived agents:</h3>
          </AccordionSummary>
          <AccordionDetails>
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
