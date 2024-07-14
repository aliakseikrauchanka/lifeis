import React from 'react';
import { Link } from 'react-router-dom';
import { LogForm } from '../components/log-form/log-form';

export const LogsPage = () => {
  return (
    <main>
      <div>
        <Link to="/">Click here to go back to root page.</Link>
      </div>
      <LogForm />
    </main>
  );
};
