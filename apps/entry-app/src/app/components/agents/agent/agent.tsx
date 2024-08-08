import { EditableInput, OwnButton } from '@lifeis/common-ui';
import { removeAgent, submitMessage, updateAgent } from '../../../api/agents/agents.api';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { IconButton } from '@mui/joy';
import { CopyAll, Delete, DeleteForever, DragHandle } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';

interface IAgentProps {
  id: string;
  name: string;
  prefix: string;
  focused: boolean;
  number?: number;
}

export const Agent = ({ id, name, prefix, focused, number }: IAgentProps) => {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const removeMutation = useMutation({
    mutationFn: removeAgent,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: updateAgent,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  useEffect(() => {
    if (textAreaRef.current && focused) {
      textAreaRef?.current.focus();
    }
  }, [focused]);

  const submit = async () => {
    const response = await submitMessage({ id, message });
    const purifiedDom = domPurify.sanitize(response.answer);
    setAnswer(purifiedDom);
  };

  const handleSubmitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submit();
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
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(responseRef.current?.textContent || '');
  };

  const handleResponseDelete = () => {
    setAnswer('');
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

      {/* <Textarea
        ref={textAreaRef}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
        }}
        // onKeyPress={handleKeyPress}
        className={css.agentInput}
        minRows={3}
      /> */}

      <div className={css.agentInputWrapper}>
        <textarea
          onDrop={handleDrop}
          ref={textAreaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className={css.agentInput}
        />
        <div className={css.agentDragIcon}></div>
      </div>
      <div className={css.agentButtons}>
        <OwnButton type="button" color="danger" onClick={handleClearText}>
          Clear
        </OwnButton>
        <OwnButton type="submit">Submit</OwnButton>
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
              <IconButton
                aria-label="Delete"
                size="sm"
                color="primary"
                onClick={handleResponseDelete}
                className={css.agentResponseDeleteBtn}
                style={{
                  marginLeft: 'auto',
                }}
              >
                <Delete />
              </IconButton>
            </>
          )}
        </h4>
        <div ref={responseRef}>{<ReactMarkdown>{answer}</ReactMarkdown>}</div>
      </div>
    </form>
  );
};
