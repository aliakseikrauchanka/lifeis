import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm, IEditLog } from '../components/log-form/log-form';
import { deleteLog, getAllLogs } from '../api/logs/logs.api';
import { Box, Chip, IconButton, MenuItem, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { getAllBaskets } from '../api/baskets/baskets.api';
import css from './logs.page.module.scss';

export type PeriodType = 'all' | 'today' | 'week' | 'range';

export const LogsPage = () => {
  const [baskets, setBaskets] = useState<{ _id: string; name: string }[]>([]);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('logs-form-expanded');
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('logs-form-expanded', JSON.stringify(isFormExpanded));
  }, [isFormExpanded]);

  // Fetch baskets on mount
  useEffect(() => {
    const fetchBaskets = async () => {
      try {
        const res = await getAllBaskets();
        setBaskets((res as any).baskets || []);
      } catch (e) {}
    };
    fetchBaskets();
  }, []);
  const [period, setPeriod] = useState<PeriodType>('today');
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [selectedBasketId, setSelectedBasketId] = useState<string | ''>('');
  const [logs, setLogs] = useState<IDiaryLog[]>();

  const fetchLogs = useCallback(
    async (periodValue: PeriodType, range?: { from: Date | null; to: Date | null }, basketId?: string) => {
      let from: Date | undefined;
      let to: Date | undefined;
      if (periodValue === 'today') {
        from = startOfDay(new Date());
      } else if (periodValue === 'week') {
        const now = new Date();
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
      } else if (periodValue === 'range') {
        from = range?.from ? startOfDay(range.from) : undefined;
        to = range?.to
          ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999)
          : undefined;
      }
      const response = await getAllLogs(from, to, basketId || undefined);
      const logsData = response.logs;
      setLogs(logsData);
    },
    [],
  );

  const handleChange = (event: React.MouseEvent<HTMLElement>, newPeriod: PeriodType | null) => {
    if (newPeriod !== null) {
      setPeriod(newPeriod);
    }
  };

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
          compact={!isFormExpanded}
        />
      </div>
      <div className={css.controlsRow}>
        <IconButton
          size="small"
          className={css.expandButton}
          onClick={() => setIsFormExpanded((v: boolean) => !v)}
          aria-label={isFormExpanded ? 'Shrink form' : 'Expand form'}
          title={isFormExpanded ? 'Shrink form to show more logs' : 'Expand form'}
        >
          {isFormExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </div>
      <Box className={css.logsContainer}>
        <div className={css.basketFilterRow}>
          <Select
            value={selectedBasketId}
            onChange={(e) => setSelectedBasketId(e.target.value)}
            displayEmpty
            size="small"
            variant="outlined"
            className={css.basketFilterSelect}
            renderValue={(v) => (v ? baskets.find((b) => b._id === v)?.name ?? v : 'Basket (all)')}
          >
            <MenuItem value="">All</MenuItem>
            {baskets.map((b) => (
              <MenuItem key={b._id} value={b._id}>
                {b.name}
              </MenuItem>
            ))}
          </Select>
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={handleChange}
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
                onChange={(date) => setDateRange((prev) => ({ ...prev, from: date ?? null }))}
                slotProps={{ textField: { size: 'small' } }}
                maxDate={dateRange.to ?? undefined}
              />
              <DatePicker
                label="To"
                value={dateRange.to}
                onChange={(date) => setDateRange((prev) => ({ ...prev, to: date ?? null }))}
                slotProps={{ textField: { size: 'small' } }}
                minDate={dateRange.from ?? undefined}
              />
            </Box>
          )}
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
                  {sortedLogs.map((log) => (
                    <li key={log.id} className={css.logItem}>
                      <div className={css.logContent}>
                        <div>{log.message}</div>
                        <div className={css.logFooter}>
                          <Chip label={log.basket_name} size="small" variant="outlined" />
                          <small>{new Date(log.timestamp).toLocaleString()}</small>
                        </div>
                      </div>
                      <span className={css.logActions}>
                        <button className={css.editButton} onClick={() => setEditLogId(log.id)}>
                          Edit
                        </button>
                        <button className={css.deleteButton} onClick={() => handleDeleteLog(log.id)}>
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </Box>
    </main>
  );
};
