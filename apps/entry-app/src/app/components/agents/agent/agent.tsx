import { OwnButton } from '@lifeis/common-ui';
import { removeAgent, submitMessage, updateAgent } from '../../../api/agents/agents.api';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { IconButton, Textarea } from '@mui/joy';
import { Delete } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditableInput } from './components/editable-input';

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
  const textAreaRef = useRef<Textarea | null>(null);
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

      <textarea
        ref={textAreaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        className={css.agentInput}
      />
      <div className={css.agentButtons}>
        <OwnButton type="submit">Submit</OwnButton>
      </div>
      <div>
        <h4>Response:</h4>
        <ReactMarkdown>{answer}</ReactMarkdown>
      </div>
    </form>
  );
};
