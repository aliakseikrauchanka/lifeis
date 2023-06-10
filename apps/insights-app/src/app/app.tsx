// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import styles from './app.module.scss';

import { Button } from '@lifeis/common-ui';
import NxWelcome from './nx-welcome';

export function App() {
  return (
    <div>
      <Button />
      <NxWelcome title="insights" />
      <div>test</div>
    </div>
  );
}

export default App;
