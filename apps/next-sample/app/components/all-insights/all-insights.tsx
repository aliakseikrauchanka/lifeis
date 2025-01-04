'use client';

import React, { useEffect, useState } from 'react';
// import { GET } from '../../api/insights/route';

export const AllInsights = () => {
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const insightsResponse = await fetch('/api/insights');
      const insights = await insightsResponse.json();
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
