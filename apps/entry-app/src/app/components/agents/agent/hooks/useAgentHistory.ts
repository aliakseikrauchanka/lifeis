import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgentHistory } from '../../../../api/agents/agents.api';
import { IAgentHistoryItem } from '../../../../domains/agent.domain';

const EMPTY_HISTORY_ITEM: IAgentHistoryItem = {
  _id: '',
  agentId: '',
  prefix: '',
  message: '',
  prompt: '',
  response: '',
  timestamp: new Date(),
} as const;

const CLIPBOARD_ITEMS_LENGTH = 50;

export const useAgentHistory = (id: string, hasSubmitted: boolean) => {
  const [historyCurrentIndex, setHistoryCurrentIndex] = useState(0);

  const { data: agentHistory } = useQuery({
    queryKey: ['agents-history', id],
    queryFn: () => getAgentHistory(id),
    select: (data) => data.history,
  });

  useEffect(() => {
    if (agentHistory) {
      setHistoryCurrentIndex(0);
    }
  }, [agentHistory]);

  const clientHistoryItems = useMemo(() => {
    if (!hasSubmitted) {
      return agentHistory ? [EMPTY_HISTORY_ITEM, ...agentHistory] : [];
    }
    return agentHistory ?? [];
  }, [hasSubmitted, agentHistory]);

  const handleHistoryIndexChange = useCallback(
    (index: number): { message: string; response: string; agentType?: string } => {
      setHistoryCurrentIndex(index);
      const historyItem = clientHistoryItems?.[index];
      return {
        message: historyItem?.message || '',
        response: historyItem?.response || '',
        agentType: historyItem?.agentType,
      };
    },
    [clientHistoryItems],
  );

  const handleHistoryEduClick = useCallback(async () => {
    const clipboardText =
      'Let us traing unique polish words from the list: \n' +
        clientHistoryItems
          ?.slice(0, CLIPBOARD_ITEMS_LENGTH)
          .map((item) => `- ${item.message}`)
          .join('\n') || '';
    await navigator.clipboard.writeText(clipboardText);
  }, [clientHistoryItems]);

  return {
    clientHistoryItems,
    historyCurrentIndex,
    handleHistoryIndexChange,
    handleHistoryEduClick,
  };
};
