import React, { useEffect, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm, IEditLog } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { startOfDay } from 'date-fns';
import { getAllBaskets } from '../api/baskets/baskets.api';

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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px', width: '180px' }}>
                Basket Name
              </th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Logs</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(logsByBasket).map(([basket, basketLogs]) => (
              <tr key={basket}>
                <td
                  style={{
                    verticalAlign: 'top',
                    padding: '8px',
                    fontWeight: 'bold',
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px',
                    wordBreak: 'break-word',
                  }}
                >
                  {basket}
                </td>
                <td style={{ padding: '8px' }}>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {basketLogs.map((log) => (
                      <li
                        key={log.id}
                        style={{
                          marginBottom: '12px',
                          position: 'relative',
                          borderBottom: '1px solid #eee',
                          paddingBottom: 8,
                        }}
                      >
                        <div>{log.message}</div>
                        <small>{new Date(log.timestamp).toLocaleString()}</small>
                        <div style={{ marginTop: 4 }}>
                          <button
                            style={{
                              marginLeft: 8,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#1976d2',
                              fontWeight: 'bold',
                            }}
                            onClick={() => setEditLogId(log.id)}
                          >
                            Edit
                          </button>
                        </div>
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
