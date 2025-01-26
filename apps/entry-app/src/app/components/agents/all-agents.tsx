import { getAllAgents } from '../../api/agents/agents.api';
import React, { useEffect, useRef, useState } from 'react';
import { Agent } from './agent/agent';
import AgentForm from './agent-create/agent-create';
import css from './all-agents.module.scss';
import { useQuery } from '@tanstack/react-query';
import { IAgentResponse } from '../../domains/agent.domain';
import { useStorageContext } from '../../contexts/storage.context';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/joy';
import classNames from 'classnames';
import { textToSpeech } from '../../api/assistants/assistants.api';
import { AgentSearch } from './agent-search/agent-search';

const AVAILABLE_KEYS = ['1', '2', '3', '4', '5'];

export const AllAgents = () => {
  const query = useQuery({ queryKey: ['agents'], queryFn: getAllAgents, select: (data) => data.agents });

  const { pinnedAgentsIds, languageCode } = useStorageContext();

  const [focusedAgentIndex, setFocusedAgentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const agents = query.data?.filter((agent) => agent.type === 'agent' || !agent.type) ?? [];
  const nonArchivedAgents = agents.filter((agent) => !agent.isArchived);
  const archivedAgents = agents.filter((agent) => !!agent.isArchived);

  const pinnedAgents = pinnedAgentsIds
    .map((id) => nonArchivedAgents.find((agent) => agent._id === id))
    .filter((agent) => !!agent) as IAgentResponse[]; // TODO: ???
  const nonPinnedAgents = nonArchivedAgents.filter((agent) => !pinnedAgentsIds.includes(agent._id));
  const sortedAgents = [...pinnedAgents, ...nonPinnedAgents];

  const agentTemplates = query.data?.filter((agent) => agent.type === 'template') ?? [];

  // Inside your component:
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleAgentSelect = (agentId: string) => {
    setFocusedAgentIndex(sortedAgents.findIndex((agent) => agent._id === agentId));
  };

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
      setSelectionRect(null);
      setSelectionText('');
      setCurAudioBase64('');
      audioRef.current?.pause();
    }
  };

  const playBase64Audio = (base64Audio: string) => {
    setCurAudioBase64(base64Audio);
    if (audioRef.current) {
      // Convert base64 to blob
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });

      // Create and play audio
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();

      // Cleanup
      audioRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

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
              isArchived={!!agent.isArchived}
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
              {/* {selectionText} */}
              <button
                onClick={async () => {
                  let audioContent;
                  if (!curAudioBase64) {
                    audioContent = await textToSpeech(selectionText, languageCode);
                  } else {
                    audioContent = curAudioBase64;
                  }
                  if (audioContent) {
                    playBase64Audio(audioContent);
                  }
                }}
              >
                Speak
              </button>
              <button
                onClick={() => {
                  audioRef.current?.pause();
                }}
              >
                Stop
              </button>
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
