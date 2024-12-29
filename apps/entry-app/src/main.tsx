import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import flagsmith from 'flagsmith';
import { FlagsmithProvider } from 'flagsmith/react';
import * as Sentry from '@sentry/react';

import App from './app/app';
import { BrowserRouter } from 'react-router-dom';
import { StorageProvider } from './app/contexts/storage.context';

import.meta.env.VITE_SENTRY_DSN &&
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
      Sentry.feedbackIntegration({
        // Additional SDK configuration goes in here, for example:
        colorScheme: 'system',
        isNameRequired: true,
        position: 'bottom-left',
      }),
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ['localhost', /^https:\/\/lifeis-agents\.vercel\.app/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });

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
