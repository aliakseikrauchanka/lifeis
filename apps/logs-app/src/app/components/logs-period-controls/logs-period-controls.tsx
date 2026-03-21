import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import css from './logs-period-controls.module.scss';

export type PeriodType = 'today' | 'week' | 'all' | 'range';

export interface LogsPeriodControlsProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  dateRange: { from: Date | null; to: Date | null };
  onDateRangeChange: (range: { from: Date | null; to: Date | null }) => void;
  className?: string;
}

export const LogsPeriodControls = ({
  period,
  onPeriodChange,
  dateRange,
  onDateRangeChange,
  className,
}: LogsPeriodControlsProps) => {
  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, newPeriod: PeriodType | null) => {
    if (newPeriod !== null) onPeriodChange(newPeriod);
  };

  return (
    <div className={className ?? css.controlsRow}>
      <ToggleButtonGroup
        value={period}
        exclusive
        onChange={handlePeriodChange}
        aria-label="Period selection"
        size="small"
      >
        <ToggleButton value="today" aria-label="Today">
          Today
        </ToggleButton>
        <ToggleButton value="week" aria-label="This week">
          Week
        </ToggleButton>
        <ToggleButton value="all" aria-label="All time">
          All
        </ToggleButton>
        <ToggleButton value="range" aria-label="Date range">
          Range
        </ToggleButton>
      </ToggleButtonGroup>
      {period === 'range' && (
        <Box className={css.dateRangePickers}>
          <DatePicker
            label="From"
            value={dateRange.from}
            onChange={(date) => onDateRangeChange({ ...dateRange, from: date ?? null })}
            slotProps={{ textField: { size: 'small' } }}
            maxDate={dateRange.to ?? undefined}
          />
          <DatePicker
            label="To"
            value={dateRange.to}
            onChange={(date) => onDateRangeChange({ ...dateRange, to: date ?? null })}
            slotProps={{ textField: { size: 'small' } }}
            minDate={dateRange.from ?? undefined}
          />
        </Box>
      )}
    </div>
  );
};
