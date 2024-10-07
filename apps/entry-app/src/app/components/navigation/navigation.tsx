import React from 'react';
import { Link } from 'react-router-dom';

export const Navigation = () => {
  return (
    <div>
      <div>
        <Link to="/logs">Logs</Link>
      </div>
      <div>
        <Link to="/experiments">Experiments</Link>
      </div>
      <div>
        <Link to="/">Agents</Link>
      </div>
    </div>
  );
};
