import { ChevronLeft, ChevronRight, History, HistoryEdu } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { IAgentHistoryItem } from '../../../../../domains/agent.domain';
import { OwnButton } from '@lifeis/common-ui';
import { useCallback } from 'react';

interface IAgentHistoryNavigationProps {
  className: string;
  index: number;
  historyItems: IAgentHistoryItem[] | undefined;
  onIndexChange: (index: number) => void;
  onHistoryClick: () => void;
}

const clipboardItemsLenth = 50;

export const AgentHistoryNavigation = ({
  className,
  index,
  historyItems,
  onIndexChange,
  onHistoryClick,
}: IAgentHistoryNavigationProps) => {
  const handlePreviousClick = () => {
    onIndexChange(index + 1);
  };
  const handleNextClick = async () => {
    onIndexChange(index - 1);
  };

  const handleHistoryEduClick = useCallback(async () => {
    const text =
      historyItems
        ?.slice(0, clipboardItemsLenth)
        .map((item) => item.message)
        .join('\n') || '';
    await navigator.clipboard.writeText(text);
  }, [historyItems]);

  return (
    <div className={className}>
      <IconButton
        aria-label="Copy"
        size="sm"
        color="primary"
        disabled={index > (historyItems?.length ?? 0) - 1}
        onClick={handlePreviousClick}
      >
        <ChevronLeft />
      </IconButton>
      <IconButton aria-label="Copy" size="sm" color="primary" disabled={index <= 0} onClick={handleNextClick}>
        <ChevronRight />
      </IconButton>
      {/* <IconButton aria-label="Copy" size="sm" color="primary" disabled={index === 0} onClick={handleReset}>
        <LastPage />
      </IconButton> */}
      <OwnButton
        type="button"
        onClick={handleHistoryEduClick}
        disabled={!historyItems?.length}
        variant="plain"
        style={{ marginTop: 'auto', marginBottom: '10px', height: '30px' }}
      >
        <HistoryEdu />
      </OwnButton>
      <OwnButton
        type="button"
        onClick={onHistoryClick}
        disabled={!historyItems?.length}
        variant="plain"
        style={{ marginBottom: '20px', height: '30px' }}
      >
        <History />
      </OwnButton>
    </div>
  );
};
