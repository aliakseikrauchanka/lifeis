import React from 'react';
import { AllInsights } from '../components/insights/insights';
import { Link } from 'react-router-dom';

export const InsightsPage = () => {
  return (
    <main>
      <div>
        <Link to="/">Click here to go back to root page.</Link>
      </div>
      <AllInsights />
    </main>
  );
};
