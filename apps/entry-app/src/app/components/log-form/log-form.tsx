import React from 'react';
import { createLog } from '../../api/logs/logs.api';

export const LogForm = () => {
  const [message, setMessage] = React.useState('');
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createLog(message);
      setMessage('');
    } catch (e) {
      console.log('error happened during fetch');
    }
  };
  return (
    <form method="post" onSubmit={handleSubmit}>
      <textarea value={message} name="message" placeholder="Enter your message here" onChange={handleChange} />
      <button type="submit">Submit</button>
    </form>
  );
};
