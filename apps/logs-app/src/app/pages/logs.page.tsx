import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm, IEditLog } from '../components/log-form/log-form';
import { BasketSelect } from '../components/basket-select';
import { LogsPeriodControls, type PeriodType } from '../components/logs-period-controls';
import { deleteLog, getAllLogs } from '../api/logs/logs.api';
import { useBaskets } from '../hooks/use-baskets';
import { getLogsPeriodDates } from '../utils/logs-period.utils';
import { Box, Chip } from '@mui/material';
import { isToday, isYesterday, format } from 'date-fns';
import css from './logs.page.module.scss';

const getDateLabel = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMM d, yyyy');
};

export const LogsPage = () => {
  const { baskets } = useBaskets();
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('today');
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [selectedBasketId, setSelectedBasketId] = useState<string | ''>('');
  const [logs, setLogs] = useState<IDiaryLog[]>();

  const fetchLogs = useCallback(
    async (periodValue: PeriodType, range?: { from: Date | null; to: Date | null }, basketId?: string) => {
      const { from, to } = getLogsPeriodDates(periodValue, range ?? { from: null, to: null });
      const response = await getAllLogs(from, to, basketId || undefined);
      const logsData = response.logs;
      setLogs(logsData);
    },
    [],
  );

  useEffect(() => {
    if (period === 'range') {
      fetchLogs(period, dateRange, selectedBasketId || undefined);
    } else {
      fetchLogs(period, undefined, selectedBasketId || undefined);
    }
  }, [period, dateRange, selectedBasketId, fetchLogs]);

  const sortedLogs = useMemo(
    () => [...(logs ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [logs],
  );

  const logsWithDateHeaders = useMemo(() => {
    const items: Array<{ type: 'date-header'; label: string; dateKey: string } | { type: 'log'; log: IDiaryLog }> = [];
    let lastDateKey = '';

    for (const log of sortedLogs) {
      const logDate = new Date(log.timestamp);
      const dateKey = format(logDate, 'yyyy-MM-dd');

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        if (!isToday(logDate)) {
          items.push({ type: 'date-header', label: getDateLabel(logDate), dateKey });
        }
      }
      items.push({ type: 'log', log });
    }

    return items;
  }, [sortedLogs]);

  const editLog = useMemo((): IEditLog | undefined => {
    if (!editLogId || !logs) return undefined;
    const log = logs.find((l) => l.id === editLogId);
    return log ? { id: log.id, message: log.message, basket_name: log.basket_name } : undefined;
  }, [editLogId, logs]);

  const handleDeleteLog = useCallback(
    async (logId: string) => {
      if (!window.confirm('Are you sure you want to delete this log?')) return;
      try {
        await deleteLog(logId);
        setEditLogId((id) => (id === logId ? null : id));
        if (period === 'range') {
          fetchLogs(period, dateRange, selectedBasketId || undefined);
        } else {
          fetchLogs(period, undefined, selectedBasketId || undefined);
        }
      } catch {
        console.error('Failed to delete log');
      }
    },
    [period, dateRange, selectedBasketId, fetchLogs],
  );

  return (
    <main className={css.logsPage}>
      <div className={css.formSection}>
        <LogForm
          onSubmit={() => {
            setEditLogId(null);
            if (period === 'range') {
              fetchLogs(period, dateRange, selectedBasketId || undefined);
            } else {
              fetchLogs(period, undefined, selectedBasketId || undefined);
            }
          }}
          editLog={editLog}
          onEditCancel={() => setEditLogId(null)}
          baskets={baskets}
        />
      </div>
      <Box className={css.logsContainer}>
        <div className={css.basketFilterRow}>
          <BasketSelect baskets={baskets} value={selectedBasketId} onChange={setSelectedBasketId} />
          <LogsPeriodControls
            period={period}
            onPeriodChange={setPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
        <table className={css.logsTable}>
          <thead>
            <tr>
              <th>Logs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <ul className={css.logsList}>
                  {logsWithDateHeaders.map((item) =>
                    item.type === 'date-header' ? (
                      <li key={item.dateKey} className={css.logDateHeader}>
                        {item.label}
                      </li>
                    ) : (
                      <li key={item.log.id} className={css.logItem}>
                        <div className={css.logContent}>
                          <div>{item.log.message}</div>
                          <div className={css.logFooter}>
                            <Chip label={item.log.basket_name} size="small" variant="outlined" />
                            <small>{new Date(item.log.timestamp).toLocaleString()}</small>
                          </div>
                        </div>
                        <span className={css.logActions}>
                          <button className={css.editButton} onClick={() => setEditLogId(item.log.id)}>
                            Edit
                          </button>
                          <button className={css.deleteButton} onClick={() => handleDeleteLog(item.log.id)}>
                            Delete
                          </button>
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </main>
  );
};
