import { OwnButton } from '@lifeis/common-ui';
import { removeAgent, submitMessage } from '../../api/agents/agents';
import { useState, KeyboardEvent, FormEvent, MouseEvent } from 'react';

interface IAgentProps {
  id: string;
  name: string;
  onRemove?: () => void;
}

export const Agent = ({ id, name, onRemove }: IAgentProps) => {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');

  const submit = async () => {
    const response = await submitMessage({ id, message });
    setAnswer(response.answer);
  };

  const handleSubmitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
    <form onSubmit={handleSubmitForm}>
      <h3>Agent: {name}</h3>
      <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={handleKeyPress} />
      <OwnButton type="submit">Submit message</OwnButton>
      <OwnButton style={{ backgroundColor: 'red' }} onClick={handleRemoveAgent}>
        Remove agent
      </OwnButton>
      <div>
        <h4>Answer:</h4>
        <p>{answer}</p>
      </div>
    </form>
  );
};
