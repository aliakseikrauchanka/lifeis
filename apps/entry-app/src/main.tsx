import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './app/app';
import { BrowserRouter } from 'react-router-dom';
import { StorageProvider } from './app/contexts/storage.context';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const queryClient = new QueryClient();

root.render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <StorageProvider>
          <App />
        </StorageProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
