import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import flagsmith from 'flagsmith';
import { FlagsmithProvider } from 'flagsmith/react';

import App from './app/app';
import { BrowserRouter } from 'react-router-dom';
import { StorageProvider } from './app/contexts/storage.context';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const queryClient = new QueryClient();

root.render(
  <StrictMode>
    <FlagsmithProvider
      options={{
        environmentID: import.meta.env.VITE_FF_ENVIRONMENT,
      }}
      flagsmith={flagsmith}
    >
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <StorageProvider>
            <App />
          </StorageProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </FlagsmithProvider>
  </StrictMode>,
);
