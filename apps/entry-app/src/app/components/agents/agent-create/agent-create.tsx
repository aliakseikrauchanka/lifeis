import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { createAgent } from '../../../api/agents/agents.api';
import css from './agent-create.module.scss';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OwnButton } from '@lifeis/common-ui';

const AgentForm = () => {
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  return (
    <Formik
      initialValues={{ name: '', prefix: '' }}
      onSubmit={async (values, { resetForm }) => {
        await createMutation.mutateAsync(values);
        resetForm();
      }}
    >
      {({ isSubmitting }) => (
        <Form className={css.agentCreate}>
          <h2>Create agent</h2>
          <div>
            <label htmlFor="name">Name:</label>
            <Field type="text" id="name" name="name" className={css.agentCreateInputFullWidth} />
            <ErrorMessage name="name" component="div" />
          </div>
          <div>
            <label htmlFor="prefix">Instructions (Prefix):</label>
            <Field as="textarea" id="prefix" name="prefix" className={css.agentCreateInputFullWidth} />
            <ErrorMessage name="prefix" component="div" />
          </div>
          <OwnButton type="submit" disabled={isSubmitting}>
            Create
          </OwnButton>
        </Form>
      )}
    </Formik>
  );
};

export default AgentForm;
