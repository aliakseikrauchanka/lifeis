import { OwnButton } from '@lifeis/common-ui';
import { submitMessage } from '../../api/agents/agents';
import { useState } from 'react';

interface IAgentProps {
  id: string;
  name: string;
}

export const Agent = ({ id, name }: IAgentProps) => {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');

  const submit = async () => {
    const response = await submitMessage({ id, message });
    setAnswer(response.answer);
  };

  const handleSubmitMessage = () => {
    submit();
  };
  return (
    <div>
      <h3>Agent: {name}</h3>
      <input value={message} onChange={(e) => setMessage(e.target.value)} />
      <OwnButton onClick={handleSubmitMessage}>Submit message</OwnButton>
      <div>
        <h4>Answer:</h4>
        <p>{answer}</p>
      </div>
    </div>
  );
};
