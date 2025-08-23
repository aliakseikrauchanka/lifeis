import React, { useEffect, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { LogForm } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import { Logs } from '../components/logs/logs';
import { Box, Grid, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { startOfDay } from 'date-fns';
import { utilFetch } from '@lifeis/common-ui';
import { getAllBaskets } from '../api/baskets/baskets.api';

export const LogsPage = () => {
  const [baskets, setBaskets] = useState<{ _id: string; name: string }[]>([]);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [updatingLogId, setUpdatingLogId] = useState<string | null>(null);

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
                          {editLogId === log.id ? (
                            <>
                              <button
                                style={{
                                  marginRight: 8,
                                  color: 'red',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                }}
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to delete this log?')) {
                                    setUpdatingLogId(log.id);
                                    await utilFetch(`/logs/${log.id}`, { method: 'DELETE' });
                                    setUpdatingLogId(null);
                                    fetchLogs(period);
                                    setEditLogId(null);
                                  }
                                }}
                                disabled={updatingLogId === log.id}
                              >
                                Delete
                              </button>
                              <button
                                style={{
                                  marginLeft: 8,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#888',
                                }}
                                onClick={() => setEditLogId(null)}
                              >
                                Cancel
                              </button>
                              {baskets.map((b) => (
                                <button
                                  key={b._id}
                                  style={{
                                    marginRight: 4,
                                    padding: '2px 8px',
                                    borderRadius: 16,
                                    border: log.basket_name === b.name ? '2px solid #1976d2' : '1px solid #ccc',
                                    background: log.basket_name === b.name ? '#e3f2fd' : 'white',
                                    color: log.basket_name === b.name ? '#1976d2' : 'black',
                                    fontWeight: log.basket_name === b.name ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                  }}
                                  onClick={async () => {
                                    if (log.basket_name !== b.name) {
                                      setUpdatingLogId(log.id);
                                      await utilFetch(`/logs/${log.id}/basket`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ basket_id: b._id }),
                                      });
                                      setUpdatingLogId(null);
                                      fetchLogs(period);
                                    }
                                  }}
                                  disabled={updatingLogId === log.id}
                                >
                                  {b.name}
                                </button>
                              ))}
                            </>
                          ) : (
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
                          )}
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
