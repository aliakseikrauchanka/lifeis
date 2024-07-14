import React from 'react';
import { Link } from 'react-router-dom';

export const MainPage = () => {
  return (
    <div>
      <div>
        <Link to="/insights">insight page</Link>
      </div>
      <div>
        <Link to="/logs">logs page</Link>
      </div>
      <div>
        <Link to="/experiments">experiments page</Link>
      </div>
      <div>
        <Link to="/agents">agents page</Link>
      </div>
    </div>
  );
};
