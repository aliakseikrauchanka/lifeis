import { ForkLeft, ForkRight, RampRight } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { IAgentHistoryItem } from '../../../../../domains/agent.domain';

interface IAgentHistoryNavigationProps {
  className: string;
  index: number;
  onIndexChange: (index: number) => void;
  historyItems: IAgentHistoryItem[] | undefined;
}

export const AgentHistoryNavigation = ({
  className,
  index,
  onIndexChange,
  historyItems,
}: IAgentHistoryNavigationProps) => {
  const handlePreviousClick = () => {
    onIndexChange(index + 1);
  };
  const handleNextClick = () => {
    onIndexChange(index - 1);
  };
  const handleReset = () => {
    onIndexChange(0);
  };
  return (
    <div className={className}>
      <IconButton
        aria-label="Copy"
        size="sm"
        color="primary"
        disabled={index > (historyItems?.length ?? 0) - 1}
        onClick={handlePreviousClick}
      >
        <ForkLeft />
      </IconButton>
      <IconButton aria-label="Copy" size="sm" color="primary" disabled={index === 0} onClick={handleNextClick}>
        <ForkRight />
      </IconButton>
      <IconButton aria-label="Copy" size="sm" color="primary" disabled={index === 0} onClick={handleReset}>
        <RampRight />
      </IconButton>
    </div>
  );
};
