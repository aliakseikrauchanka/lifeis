import { OwnButton } from '@lifeis/common-ui';
import { removeAgent, submitMessage } from '../../../api/agents/agents';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

interface IAgentProps {
  id: string;
  name: string;
  prefix: string;
  focused: boolean;
  number?: number;
  onRemove?: () => void;
}

export const Agent = ({ id, name, prefix, focused, number, onRemove }: IAgentProps) => {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submit();
    }
  };

  const handleRemoveAgent = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (window.confirm('Are you sure you want to remove this agent?')) {
      await removeAgent(id);
      onRemove?.();
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className={css.agent}>
      <h3>
        Agent {number}: {name}
      </h3>
      <h5>{prefix}</h5>

      <textarea
        ref={textAreaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        className={css.agentInput}
      />
      <div className={css.agentButtons}>
        <OwnButton type="submit">Submit message</OwnButton>
        <OwnButton style={{ backgroundColor: 'red' }} onClick={handleRemoveAgent}>
          Remove agent
        </OwnButton>
      </div>
      <div>
        <h4>Response:</h4>
        <ReactMarkdown>{answer}</ReactMarkdown>
      </div>
    </form>
  );
};
