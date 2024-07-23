import React, { useEffect, useState } from 'react';
import { getAllInsights } from '../../api/insights/insights.api';

export const AllInsights = () => {
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const insights = await getAllInsights();
      setInsights(insights);
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
