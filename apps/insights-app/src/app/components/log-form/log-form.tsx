import { CONFIG } from '../../../../src/config';
import React from 'react';

export const LogForm = () => {
  const [message, setMessage] = React.useState('');
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accessToken = localStorage.getItem('accessToken');

    try {
      await fetch(`${CONFIG.BE_URL}/logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
    } catch (e) {
      console.log('error happened during fetch');
    }
  };
  return (
    <form method="post" onSubmit={handleSubmit}>
      <textarea
        name="message"
        placeholder="Enter your message here"
        onChange={handleChange}
      />
      <button type="submit">Submit</button>
    </form>
  );
};
