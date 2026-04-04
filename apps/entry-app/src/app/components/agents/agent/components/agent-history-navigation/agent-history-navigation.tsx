import { ChevronLeft, ChevronRight, History, HistoryEdu } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { IAgentHistoryItem } from '../../../../../domains/agent.domain';
import { OwnButton } from '@lifeis/common-ui';
import { useCallback } from 'react';

interface IAgentHistoryNavigationProps {
  className: string;
  index: number;
  /** Index is over grouped history; bounds use this count (not flat history length). */
  historyGroupCount: number;
  historyItems: IAgentHistoryItem[] | undefined;
  isEduEnabled: boolean;
  onIndexChange: (index: number) => void;
  onHistoryClick: () => void;
  onHistoryEduClick: () => void;
}

export const AgentHistoryNavigation = ({
  className,
  index,
  historyGroupCount,
  historyItems,
  isEduEnabled,
  onIndexChange,
  onHistoryClick,
  onHistoryEduClick,
}: IAgentHistoryNavigationProps) => {
  const handlePreviousClick = () => {
    onIndexChange(index + 1);
  };
  const handleNextClick = async () => {
    onIndexChange(index - 1);
  };

  const atOldestGroup = index >= historyGroupCount - 1;

  return (
    <div className={className}>
      <IconButton
        aria-label="Older history group"
        size="sm"
        color="primary"
        disabled={atOldestGroup || historyGroupCount === 0}
        onClick={handlePreviousClick}
      >
        <ChevronLeft />
      </IconButton>
      <IconButton
        aria-label="Newer history group"
        size="sm"
        color="primary"
        disabled={index <= 0}
        onClick={handleNextClick}
      >
        <ChevronRight />
      </IconButton>
      {/* <IconButton aria-label="Copy" size="sm" color="primary" disabled={index === 0} onClick={handleReset}>
        <LastPage />
      </IconButton> */}
      {isEduEnabled && (
        <OwnButton
          type="button"
          onClick={onHistoryEduClick}
          disabled={!historyItems?.length}
          variant="plain"
          style={{ marginTop: 'auto', marginBottom: '10px', height: '30px' }}
        >
          <HistoryEdu />
        </OwnButton>
      )}
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
