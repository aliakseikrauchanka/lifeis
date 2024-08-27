import { EditableInput, OwnButton } from '@lifeis/common-ui';
import { getAgentHistory, removeAgent, submitMessage, updateAgent } from '../../../api/agents/agents.api';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { IconButton, useTheme } from '@mui/joy';
import { CopyAll, Delete, DragHandle } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentHistoryModal } from './components/agent-history';
import classNames from 'classnames';
import { useMediaQuery } from '@mui/material';
import { AgentHistoryNavigation } from './components/agent-history-navigation/agent-history-navigation';
import { IAgentHistoryItem } from '../../../domains/agent.domain';

interface IAgentProps {
  id: string;
  name: string;
  prefix: string;
  focused: boolean;
  number?: number;
}

const emptyHistoryItem: IAgentHistoryItem = {
  _id: '',
  agentId: '',
  prefix: '',
  message: '',
  prompt: '',
  response: '',
  timestamp: new Date(),
} as const;

export const Agent = ({ id, name, prefix, focused, number }: IAgentProps) => {
  const [historyCurrentIndex, setHistoryCurrentIndex] = useState(0);
  const [initLoad, setInitLoad] = useState(true);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: removeAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: updateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  const submitMutation = useMutation({
    mutationFn: submitMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-history', id] });
      setInitLoad(false);
    },
  });

  const { data: agentHistory } = useQuery({
    queryKey: ['agents-history', id],
    queryFn: () => getAgentHistory(id),
    select: (data) => data.history,
  });

  useEffect(() => {
    if (agentHistory) {
      setHistoryCurrentIndex(0);
    }
  }, [agentHistory]);

  const clientHistoryItems = initLoad ? (agentHistory ? [emptyHistoryItem, ...agentHistory] : []) : agentHistory;
  console.log('debug', clientHistoryItems);

  useEffect(() => {
    if (textAreaRef.current && focused) {
      textAreaRef?.current.focus();
    }
  }, [focused]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const submitPrompt = async () => {
    const response = await submitMutation.mutateAsync({ id, message });
    const purifiedDom = domPurify.sanitize(response.answer);
    setAnswer(purifiedDom);
  };

  const handleOpenAgentHistory = async () => {
    setIsHistoryOpen(true);
  };

  const handleSubmitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitPrompt();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitPrompt();
    }
  };

  const handleRemoveAgent = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (window.confirm('Are you sure you want to remove this agent?')) {
      removeMutation.mutate(id);
    }
  };

  const handleBlurPrefix = (newValue: string) => {
    if (prefix !== newValue) {
      try {
        updateMutation.mutate({ id, name, prefix: newValue });
      } catch (error) {
        console.error('Failed to update agent name:', error);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
    e.dataTransfer.setData('text/plain', responseRef.current?.textContent || '');
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    setMessage(data);
  };

  const handleClearText = () => {
    setMessage('');
    setAnswer('');
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(responseRef.current?.textContent || '');
  };

  return (
    <form onSubmit={handleSubmitForm} className={css.agent}>
      <div className={css.agentDeleteBtnContainer}>
        <IconButton aria-label="Delete" size="sm" color="danger" onClick={handleRemoveAgent}>
          <Delete />
        </IconButton>
      </div>
      <h3>
        Agent {number}: {name}
      </h3>

      <div className={css.agentPrefixContainer}>
        <EditableInput initialValue={prefix} onValueChange={handleBlurPrefix} />
      </div>

      <div
        className={classNames(css.agentInputWrapper, {
          [css.agentInputWrapperMinimized]: isMobile,
        })}
      >
        <textarea
          onDrop={handleDrop}
          ref={textAreaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className={css.agentInput}
        />
        <AgentHistoryNavigation
          historyItems={clientHistoryItems}
          className={css.agentHistoryNavigation}
          index={historyCurrentIndex}
          onIndexChange={(index) => {
            setHistoryCurrentIndex(index);
            const historyItem = clientHistoryItems?.[index];
            setMessage(historyItem?.message || '');
            setAnswer(historyItem?.response || '');
          }}
        />
      </div>
      <div className={css.agentButtons}>
        <OwnButton type="submit">Submit</OwnButton>
        <OwnButton type="button" color="danger" onClick={handleClearText} style={{ marginLeft: 'auto' }}>
          Clear input
        </OwnButton>
        <OwnButton type="button" onClick={handleOpenAgentHistory} color="neutral">
          History
        </OwnButton>
      </div>
      <div className={css.agentResponse}>
        <h4 className={css.agentResponseTitle}>
          Response:{' '}
          {answer && (
            <>
              <IconButton aria-label="Copy" size="sm" color="primary" onClick={handleCopyResponse}>
                <CopyAll />
              </IconButton>

              <IconButton
                aria-label="Copy"
                size="sm"
                color="primary"
                onClick={handleCopyResponse}
                draggable
                onDragStart={handleDragStart}
              >
                <DragHandle />
              </IconButton>
            </>
          )}
        </h4>
        <div ref={responseRef}>{<ReactMarkdown>{answer}</ReactMarkdown>}</div>
      </div>
      <AgentHistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} agentId={id} />
    </form>
  );
};
