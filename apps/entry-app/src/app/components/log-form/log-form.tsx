import React from 'react';
import { createLog } from '../../api/logs/logs.api';
import { SpeechToText } from '../speech-to-text/speech-to-text';
import { useStorageContext } from '../../contexts/storage.context';

interface ILogFormProps {
  onSubmit: () => void;
}

export const LogForm = ({ onSubmit }: ILogFormProps) => {
  const { audioEnabled } = useStorageContext();
  const [message, setMessage] = React.useState('');
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createLog(message);
      setMessage('');
      onSubmit();
    } catch (e) {
      console.log('error happened during fetch');
    }
  };
  return (
    <form method="post" onSubmit={handleSubmit}>
      <textarea value={message} name="message" placeholder="Enter your message here" onChange={handleChange} />
      {audioEnabled && <SpeechToText onCaption={(caption) => setMessage(caption?.join(' ') || '')} id={'logger'} />}
      <button type="submit">Submit</button>
    </form>
  );
};
