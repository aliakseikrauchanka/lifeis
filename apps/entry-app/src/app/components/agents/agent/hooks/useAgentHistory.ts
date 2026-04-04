import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgentHistory } from '../../../../api/agents/agents.api';
import { IAgentHistoryItem } from '../../../../domains/agent.domain';

export type HistoryGroup = {
  message: string;
  responses: Record<string, { answer: string; status: 'done' }>;
};

const EMPTY_GROUP: HistoryGroup = { message: '', responses: {} };

const CLIPBOARD_ITEMS_LENGTH = 50;

/** Map grouped history responses to the shape used by Agent / AgentResponse tabs */
export function historyGroupToProviderResponses(group: HistoryGroup) {
  const out: Record<string, { answer: string; status: 'done' }> = {};
  for (const [key, value] of Object.entries(group.responses)) {
    out[key] = { answer: value.answer, status: 'done' };
  }
  return out;
}

function groupHistoryItems(items: IAgentHistoryItem[]): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const item of items) {
    const msg = item.message || '';
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.message === msg) {
      const key = item.agentType || 'response';
      lastGroup.responses[key] = { answer: item.response, status: 'done' };
    } else {
      const key = item.agentType || 'response';
      groups.push({
        message: msg,
        responses: { [key]: { answer: item.response, status: 'done' } },
      });
    }
  }
  return groups;
}

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

  const historyGroups = useMemo(() => {
    const groups = groupHistoryItems(agentHistory ?? []);
    if (!hasSubmitted) {
      return [EMPTY_GROUP, ...groups];
    }
    return groups;
  }, [hasSubmitted, agentHistory]);

  // Flat list for modal / History button enablement; chevrons use historyGroups.length
  const clientHistoryItems = useMemo(() => {
    const empty: IAgentHistoryItem = {
      _id: '',
      agentId: '',
      prefix: '',
      message: '',
      prompt: '',
      response: '',
      timestamp: new Date(),
    };
    if (!hasSubmitted) {
      return agentHistory ? [empty, ...agentHistory] : [];
    }
    return agentHistory ?? [];
  }, [hasSubmitted, agentHistory]);

  const handleHistoryIndexChange = useCallback(
    (index: number): HistoryGroup => {
      setHistoryCurrentIndex(index);
      const group = historyGroups[index];
      return group ?? EMPTY_GROUP;
    },
    [historyGroups],
  );

  const handleHistoryEduClick = useCallback(async () => {
    const clipboardText =
      'Let us traing unique polish words from the list: \n' +
        historyGroups
          ?.slice(0, CLIPBOARD_ITEMS_LENGTH)
          .map((g) => `- ${g.message}`)
          .join('\n') || '';
    await navigator.clipboard.writeText(clipboardText);
  }, [historyGroups]);

  return {
    clientHistoryItems,
    historyGroups,
    historyCurrentIndex,
    handleHistoryIndexChange,
    handleHistoryEduClick,
  };
};
