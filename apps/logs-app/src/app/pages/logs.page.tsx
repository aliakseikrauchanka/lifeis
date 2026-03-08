import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm, IEditLog } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import { Box, IconButton, MenuItem, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
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
      } else if (periodValue === 'range' && range?.from && range?.to) {
        from = startOfDay(range.from);
        to = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999);
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
    if (period === 'range' && dateRange.from && dateRange.to) {
      fetchLogs(period, dateRange, selectedBasketId || undefined);
    } else if (period !== 'range') {
      fetchLogs(period, undefined, selectedBasketId || undefined);
    } else if (period === 'range') {
      setLogs([]);
    }
  }, [period, dateRange, selectedBasketId, fetchLogs]);

  const logsByBasket =
    logs?.reduce<Record<string, IDiaryLog[]>>((acc, log) => {
      const basket = log.basket_name;
      if (!acc[basket]) acc[basket] = [];
      acc[basket].push(log);
      return acc;
    }, {}) || [];

  const editLog = useMemo((): IEditLog | undefined => {
    if (!editLogId || !logs) return undefined;
    const log = logs.find((l) => l.id === editLogId);
    return log ? { id: log.id, message: log.message, basket_name: log.basket_name } : undefined;
  }, [editLogId, logs]);

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
          onClick={() => setIsFormExpanded((v: boolean) => !v)}
          aria-label={isFormExpanded ? 'Shrink form' : 'Expand form'}
          title={isFormExpanded ? 'Shrink form to show more logs' : 'Expand form'}
        >
          {isFormExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <ToggleButtonGroup value={period} exclusive onChange={handleChange} aria-label="Period selection" size="small">
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
      <Box className={css.logsContainer}>
        <table className={css.logsTable}>
          <thead>
            <tr>
              <th className={css.basketNameCol}>
                <Select
                  value={selectedBasketId}
                  onChange={(e) => setSelectedBasketId(e.target.value)}
                  displayEmpty
                  size="small"
                  variant="standard"
                  disableUnderline
                  sx={{ fontSize: 'inherit', fontWeight: 600 }}
                  className={css.basketHeaderSelect}
                  renderValue={(v) => (v ? baskets.find((b) => b._id === v)?.name ?? v : 'Basket Name (all)')}
                >
                  <MenuItem value="">All</MenuItem>
                  {baskets.map((b) => (
                    <MenuItem key={b._id} value={b._id}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </th>
              <th>Logs</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(logsByBasket).map(([basket, basketLogs]) => (
              <tr key={basket}>
                <td className={css.basketNameCell}>{basket}</td>
                <td>
                  <ul className={css.logsList}>
                    {basketLogs.map((log) => (
                      <li key={log.id} className={css.logItem}>
                        <div className={css.logContent}>
                          <div>{log.message}</div>
                          <small>{new Date(log.timestamp).toLocaleString()}</small>
                        </div>
                        <button className={css.editButton} onClick={() => setEditLogId(log.id)}>
                          Edit
                        </button>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </main>
  );
};
