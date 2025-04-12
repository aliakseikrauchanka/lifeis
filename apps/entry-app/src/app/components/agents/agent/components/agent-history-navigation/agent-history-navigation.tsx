import { ChevronLeft, ChevronRight, LastPage } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { IAgentHistoryItem } from '../../../../../domains/agent.domain';
import { OwnButton } from '@lifeis/common-ui';

interface IAgentHistoryNavigationProps {
  className: string;
  index: number;
  historyItems: IAgentHistoryItem[] | undefined;
  onIndexChange: (index: number) => void;
  onHistoryClick: () => void;
}

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
  const handleNextClick = () => {
    onIndexChange(index - 1);
  };
  // const handleReset = () => {
  //   onIndexChange(0);
  // };
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
        onClick={onHistoryClick}
        color="neutral"
        disabled={!historyItems?.length}
        style={{ marginTop: 'auto', marginBottom: '20px', height: '50px' }}
      >
        Full
      </OwnButton>
    </div>
  );
};
