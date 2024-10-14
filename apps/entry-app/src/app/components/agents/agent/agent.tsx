import { EditableInput, OwnButton } from '@lifeis/common-ui';
import { getAgentHistory, removeAgent, submitMessage, updateAgent } from '../../../api/agents/agents.api';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { IconButton, Select, useTheme, Option, Snackbar } from '@mui/joy';
import { CopyAll, Delete, DragHandle, PushPin, PushPinOutlined } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentHistoryModal } from './components/agent-history';
import classNames from 'classnames';
import { useMediaQuery } from '@mui/material';
import { AgentHistoryNavigation } from './components/agent-history-navigation/agent-history-navigation';
import { IAgentHistoryItem } from '../../../domains/agent.domain';
import { useStorageContext } from '../../../contexts/storage.context';
import { SpeechToText } from '../../speech-to-text/speech-to-text';

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
  const currentMessageRef = useRef<string>(message);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const { audioEnabled } = useStorageContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAiProvider, setSelectedAiProvider] = useState('gemini');
  const [snackBarText, setSnackBarText] = useState('');

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

  const { pinnedAgentsIds: pinnedAgents, pinAgent, unpinAgent } = useStorageContext();

  const clientHistoryItems = initLoad ? (agentHistory ? [emptyHistoryItem, ...agentHistory] : []) : agentHistory;

  useEffect(() => {
    if (textAreaRef.current && focused) {
      textAreaRef?.current.focus();
    }
  }, [focused]);

  useEffect(() => {
    if (message !== currentMessageRef.current && !message) {
      textAreaRef?.current?.focus();
    }
    currentMessageRef.current = message;
  }, [message]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const submitPrompt = async () => {
    setIsSubmitting(true);
    try {
      const response = await submitMutation.mutateAsync({ id, message, aiProvider: selectedAiProvider });
      const purifiedDom = domPurify.sanitize(response.answer);
      setAnswer(purifiedDom);
    } catch (e) {
      setSnackBarText('Problems on submitting query to AI service');
    } finally {
      setIsSubmitting(false);
    }
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
        console.error('Failed to update agent prefix:', error);
      }
    }
  };

  const handleBlurName = (newValue: string) => {
    if (name !== newValue) {
      try {
        updateMutation.mutate({ id, name: newValue, prefix });
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
      <header className={css.agentHeader}>
        <IconButton size="sm" color="primary">
          {pinnedAgents.includes(id) ? (
            <PushPin onClick={() => unpinAgent(id)} />
          ) : (
            <PushPinOutlined onClick={() => pinAgent(id)} />
          )}
        </IconButton>
        <h3 className={css.agentHeaderName} title={name}>
          <EditableInput initialValue={name} onValueChange={handleBlurName} />
        </h3>
        <div className={css.agentDeleteBtnContainer}>
          <IconButton aria-label="Delete" size="sm" color="danger" onClick={handleRemoveAgent}>
            <Delete />
          </IconButton>
        </div>
      </header>

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
        <OwnButton type="submit" disabled={!message || isSubmitting}>
          Submit
        </OwnButton>
        <Select
          value={selectedAiProvider}
          onChange={(_, newValue) => setSelectedAiProvider(newValue as string)}
          sx={{ minWidth: 120 }}
        >
          <Option value="gemini">Gemini</Option>
          <Option value="openai">OpenAI</Option>
        </Select>
        <OwnButton type="button" color="danger" onClick={handleClearText} style={{ marginLeft: 'auto' }}>
          Clear input
        </OwnButton>
        {audioEnabled && <SpeechToText onCaption={(caption) => setMessage(caption?.join(' ') || '')} id={id} />}

        <OwnButton type="button" onClick={handleOpenAgentHistory} color="neutral" disabled={!agentHistory?.length}>
          History
        </OwnButton>
      </div>
      <div className={css.agentResponse}>
        <h4 className={css.agentResponseTitle}>
          Response:{' '}
          {!isSubmitting && answer && (
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
        {isSubmitting ? 'Generating ...' : <div ref={responseRef}>{<ReactMarkdown>{answer}</ReactMarkdown>}</div>}
      </div>
      <AgentHistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} agentId={id} />
      <Snackbar
        anchorOrigin={{
          horizontal: 'center',
          vertical: 'bottom',
        }}
        color="danger"
        autoHideDuration={2000}
        open={!!snackBarText}
        variant="solid"
        onClose={(event, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setSnackBarText('');
        }}
      >
        {snackBarText}
      </Snackbar>
    </form>
  );
};
