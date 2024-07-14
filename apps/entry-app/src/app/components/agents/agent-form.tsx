import React, { ChangeEventHandler, FormEventHandler, useState } from 'react';
import { OwnButton } from '@lifeis/common-ui';
import { createAgent } from '../../api/agents/agents';

interface IAgentFormProps {
  onCreate: () => void;
}

const AgentForm = ({ onCreate }: IAgentFormProps) => {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');

  const handleNameChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setName(e.target.value);
  };

  const handlePrefixChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setPrefix(e.target.value);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    try {
      await createAgent({ name, prefix });
      onCreate();
    } catch (error) {
      console.error('Failed to create agent', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name:</label>
        <input type="text" id="name" value={name} onChange={handleNameChange} />
      </div>
      <div>
        <label htmlFor="prefix">Instructions (Prefix):</label>
        <input type="text" id="prefix" value={prefix} onChange={handlePrefixChange} />
      </div>
      <OwnButton type="submit">Create Agent</OwnButton>
    </form>
  );
};

export default AgentForm;
