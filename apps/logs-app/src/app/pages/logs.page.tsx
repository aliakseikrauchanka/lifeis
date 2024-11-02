import React, { useEffect, useState } from 'react';
import { IDiaryLog } from '../domains/log.domain';
import { getAllBaskets } from '../api/baskets/baskets.api';
import Baskets from '../components/baskets/baskets';
import { LogForm } from '../components/log-form/log-form';
import { getAllLogs } from '../api/logs/logs.api';
import BasketForm from '../components/baskets/basket-form';
import { Logs } from '../components/logs/logs';

// duplicate of IBasket from api file
interface IBasket {
  _id: string;
  name: string;
}

export const LogsPage = () => {
  const [logs, setLogs] = useState<IDiaryLog[]>();
  const [baskets, setBaskets] = useState<IBasket[]>();

  const fetchLogs = async () => {
    const response = await getAllLogs();

    const logs = (response as any).logs;
    setLogs(logs);
  };

  const fetchBaskets = async () => {
    const response = await getAllBaskets();
    setBaskets((response as any).baskets);
  };

  useEffect(() => {
    fetchLogs();
    fetchBaskets();
  }, []);

  return (
    <main>
      <BasketForm onSubmit={() => fetchBaskets()} />
      <Baskets baskets={baskets} />
      <LogForm onSubmit={() => fetchLogs()} />
      <Logs logs={logs} />
    </main>
  );
};
