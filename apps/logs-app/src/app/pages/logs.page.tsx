import React, { useEffect, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import { Logs } from '../components/logs/logs';
import { Box, Grid, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { startOfDay } from 'date-fns';

export const LogsPage = () => {
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

  return (
    <main>
      <LogForm onSubmit={() => fetchLogs(period)} />
      <ToggleButtonGroup value={period} exclusive onChange={handleChange} aria-label="Period selection" size="small">
        <ToggleButton value="today" aria-label="Today">
          Today
        </ToggleButton>
        <ToggleButton value="all" aria-label="All time">
          All
        </ToggleButton>
      </ToggleButtonGroup>
      <Box mt={2}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Basket Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Logs</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(logsByBasket).map(([basket, basketLogs]) => (
              <tr key={basket}>
                <td style={{ verticalAlign: 'top', padding: '8px', fontWeight: 'bold' }}>{basket}</td>
                <td style={{ padding: '8px' }}>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {basketLogs.map((log) => (
                      <li key={log.id} style={{ marginBottom: '12px' }}>
                        <div>{log.message}</div>
                        <small>{new Date(log.timestamp).toLocaleString()}</small>
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
