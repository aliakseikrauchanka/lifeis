import { startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import type { PeriodType } from '../components/logs-period-controls';

export const getLogsPeriodDates = (
  period: PeriodType,
  dateRange: { from: Date | null; to: Date | null },
): { from?: Date; to?: Date } => {
  let from: Date | undefined;
  let to: Date | undefined;
  if (period === 'today') {
    from = startOfDay(new Date());
  } else if (period === 'week') {
    const now = new Date();
    from = startOfWeek(now, { weekStartsOn: 1 });
    to = endOfWeek(now, { weekStartsOn: 1 });
  } else if (period === 'range') {
    if (dateRange.from) from = startOfDay(dateRange.from);
    if (dateRange.to) {
      to = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate(), 23, 59, 59, 999);
    }
  }
  return { from, to };
};

export const getLogsPeriodParamsForApi = (
  period: PeriodType,
  dateRange: { from: Date | null; to: Date | null },
  basketId: string,
): { from?: string; to?: string; basketId?: string } => {
  const { from, to } = getLogsPeriodDates(period, dateRange);
  return {
    from: from?.toISOString(),
    to: to?.toISOString(),
    basketId: basketId || undefined,
  };
};
