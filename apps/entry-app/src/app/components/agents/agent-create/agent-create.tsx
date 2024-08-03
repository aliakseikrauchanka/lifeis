import React, { ChangeEventHandler, FormEventHandler, useState } from 'react';
import { OwnButton } from '@lifeis/common-ui';
import { createAgent } from '../../../api/agents/agents.api';
import css from './agent-create.module.scss';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const AgentForm = () => {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleNameChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setName(e.target.value);
  };

  const handlePrefixChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    setPrefix(e.target.value);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    await createMutation.mutateAsync({ name, prefix });
  };

  return (
    <form onSubmit={handleSubmit} className={css.agentCreate}>
      <h2>Create agent</h2>
      <div>
        <label htmlFor="name">Name:</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={handleNameChange}
          className={css.agentCreateInputFullWidth}
        />
      </div>
      <div>
        <label htmlFor="prefix">Instructions (Prefix):</label>
        <textarea id="prefix" value={prefix} onChange={handlePrefixChange} className={css.agentCreateInputFullWidth} />
      </div>
      <OwnButton type="submit">Create Agent</OwnButton>
    </form>
  );
};

export default AgentForm;
