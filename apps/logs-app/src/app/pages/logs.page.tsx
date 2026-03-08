import React, { useEffect, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm, IEditLog } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { startOfDay } from 'date-fns';
import { getAllBaskets } from '../api/baskets/baskets.api';
import css from './logs.page.module.scss';

export const LogsPage = () => {
  const [baskets, setBaskets] = useState<{ _id: string; name: string }[]>([]);
  const [editLogId, setEditLogId] = useState<string | null>(null);

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
  const [period, setPeriod] = useState<'all' | 'today'>('today');
  const [logs, setLogs] = useState<IDiaryLog[]>();

  const fetchLogs = async (period: 'all' | 'today') => {
    const now = new Date();
    let start: Date | undefined;
    if (period === 'today') {
      start = startOfDay(now);
    }
    const response = await getAllLogs(start);

    const logs = (response as any).logs;
    setLogs(logs);
  };

  const handleChange = (event: React.MouseEvent<HTMLElement>, newPeriod: 'all' | 'today' | null) => {
    if (newPeriod !== null) {
      setPeriod(newPeriod);
    }
  };

  useEffect(() => {
    fetchLogs(period);
  }, [period]);

  const logsByBasket =
    logs?.reduce<Record<string, IDiaryLog[]>>((acc, log) => {
      const basket = log.basket_name;
      if (!acc[basket]) acc[basket] = [];
      acc[basket].push(log);
      return acc;
    }, {}) || [];

  const editLog: IEditLog | undefined =
    editLogId && logs
      ? (() => {
          const log = logs.find((l) => l.id === editLogId);
          return log ? { id: log.id, message: log.message, basket_name: log.basket_name } : undefined;
        })()
      : undefined;

  return (
    <main>
      <LogForm
        onSubmit={() => {
          setEditLogId(null);
          fetchLogs(period);
        }}
        editLog={editLog}
        onEditCancel={() => setEditLogId(null)}
        baskets={baskets}
      />
      <ToggleButtonGroup value={period} exclusive onChange={handleChange} aria-label="Period selection" size="small">
        <ToggleButton value="today" aria-label="Today">
          Today
        </ToggleButton>
        <ToggleButton value="all" aria-label="All time">
          All
        </ToggleButton>
      </ToggleButtonGroup>
      <Box mt={2}>
        <table className={css.logsTable}>
          <thead>
            <tr>
              <th className={css.basketNameCol}>Basket Name</th>
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
