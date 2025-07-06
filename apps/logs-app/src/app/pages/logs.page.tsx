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
      {/* <Logs logs={logs} /> */}
      <Box display="flex" flexWrap="wrap" gap={2} justifyContent="flex-start">
        {Object.entries(logsByBasket).map(([basket, basketLogs]) => (
          <Paper
            key={basket}
            elevation={3}
            sx={{
              flex: '1 1 300px', // flexible base width
              maxWidth: '100%',
              minWidth: '280px',
              padding: 2,
            }}
          >
            <Typography variant="h6" gutterBottom>
              {basket}
            </Typography>
            <Stack spacing={1}>
              {basketLogs.map((log) => (
                <Typography key={log.id} variant="body2">
                  {log.message}
                  <br />
                  <small>{new Date(log.timestamp).toLocaleString()}</small>
                </Typography>
              ))}
            </Stack>
          </Paper>
        ))}
      </Box>
    </main>
  );
};
