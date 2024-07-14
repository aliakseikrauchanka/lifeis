import { CONFIG } from '../../../config';
import React, { useEffect, useState } from 'react';

export const Insights = () => {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const accessToken = localStorage.getItem('accessToken');
      try {
        const data = await fetch(`${CONFIG.BE_URL}/insights`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        setInsights(await data.json());
      } catch (e) {
        console.log('error happened during fetch');
      }
    };
    fetchLogs();
  }, []);

  return (
    <div>
      <h1>Insights</h1>
      <ul>{!!insights.length && insights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
    </div>
  );
};
