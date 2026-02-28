import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  removeAgent,
  submitMessage,
  updateAgent,
  createTemplate,
  cloneTemplateAgent,
} from '../../../../api/agents/agents.api';

export const useAgentMutations = (id: string, onSubmitSuccess: () => void) => {
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: removeAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const createCloneOfTemplateMutation = useMutation({
    mutationFn: cloneTemplateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-history', id] });
      onSubmitSuccess();
    },
  });

  return {
    removeMutation,
    createTemplateMutation,
    createCloneOfTemplateMutation,
    updateMutation,
    submitMutation,
  };
};
