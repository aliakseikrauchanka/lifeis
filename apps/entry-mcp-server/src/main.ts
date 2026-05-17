import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ApiClient } from './api-client';
import { randomUUID } from 'node:crypto';
import express from 'express';

const serviceApiKey = process.env.SERVICE_API_KEY;
const backendUrl = process.env.LIFEIS_BACKEND_URL || 'http://localhost:4202';
console.log('debug', 'backendUrl', backendUrl);
const mcpAuthToken = process.env.MCP_AUTH_TOKEN;
const port = parseInt(process.env.PORT || '3000', 10);

if (!serviceApiKey) {
  console.error('SERVICE_API_KEY is required');
  process.exit(1);
}

if (!mcpAuthToken) {
  console.error('MCP_AUTH_TOKEN is required');
  process.exit(1);
}

const api = new ApiClient(backendUrl, serviceApiKey);

function createMcpServer() {
  const server = new McpServer({
    name: 'lifeis-entry',
    version: '1.0.0',
  });

  server.tool(
    'create_log',
    'Create a new diary log entry. Basket is auto-resolved if not provided.',
    {
      message: z.string().describe('The log message text'),
      basket_id: z.string().optional().describe('Basket (category) ID to assign the log to'),
    },
    async ({ message, basket_id }) => {
      const result = await api.createLog(message, basket_id);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'list_logs',
    'List diary logs filtered by date range and/or basket. Returns logs sorted by newest first.',
    {
      from: z.string().optional().describe('Start date in ISO format (e.g. 2026-01-01)'),
      to: z.string().optional().describe('End date in ISO format (e.g. 2026-01-31)'),
      basket_id: z.string().optional().describe('Filter by basket (category) ID'),
    },
    async ({ from, to, basket_id }) => {
      const result = await api.listLogs(from, to, basket_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_log',
    'Update an existing diary log message and optionally its basket.',
    {
      id: z.string().describe('The log ID to update'),
      message: z.string().describe('The new log message text'),
      basket_id: z.string().optional().describe('New basket (category) ID'),
    },
    async ({ id, message, basket_id }) => {
      const result = await api.updateLog(id, message, basket_id);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'delete_log',
    'Delete a diary log by ID.',
    {
      id: z.string().describe('The log ID to delete'),
    },
    async ({ id }) => {
      const result = await api.deleteLog(id);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'create_translation',
    'Add a new word or phrase with its translation to the user library. Both languages must be valid app language codes.',
    {
      original: z.string().min(1).max(2000).describe('Original word or phrase'),
      translation: z.string().min(1).max(2000).describe('Translation of the word or phrase'),
      originalLanguage: z
        .enum(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es'])
        .describe('Language code of the original text'),
      translationLanguage: z
        .enum(['pl', 'ru-RU', 'en-US', 'de-DE', 'fr-FR', 'sr-RS', 'fi', 'es'])
        .describe('Language code of the translation'),
    },
    async ({ original, translation, originalLanguage, translationLanguage }) => {
      const result = await api.createTranslation(original, translation, originalLanguage, translationLanguage);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'list_added_words',
    "List translations the user added to the library since the given timestamp. Each item includes the translation fields and an `enrolled` flag indicating whether it's enrolled in SRS. Use this to recap what the user added today. Defaults to start of UTC day if `since` is omitted.",
    {
      since: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(
          'Epoch-ms cutoff; results have timestamp >= since. Defaults to start of UTC day. Server clamps to no older than 180 days.',
        ),
    },
    async ({ since }) => {
      const cutoff = since ?? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
      const result = await api.addedSince(cutoff);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'review_today_words',
    "List the words the user has practiced today via SRS — i.e. flashcards reviewed since the given timestamp. Each result includes the SRS state and the joined translation (original word + translation). Use this to recap what the user has been working on today. Defaults to start of UTC day if `since` is omitted.",
    {
      since: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('Epoch-ms cutoff; results have last_reviewed_at >= since. Defaults to start of UTC day.'),
    },
    async ({ since }) => {
      const cutoff = since ?? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
      const result = await api.trainedToday(cutoff);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

// Auth middleware for MCP endpoint — accepts token via Authorization header or ?token= query param
app.use('/mcp', (req, res, next) => {
  const headerOk = req.headers.authorization === `Bearer ${mcpAuthToken}`;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const queryOk = queryToken === mcpAuthToken;
  if (!headerOk && !queryOk) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// Map to store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// Handle MCP requests (POST for JSON-RPC, GET for SSE stream, DELETE for session cleanup)
app.all('/mcp', async (req, res) => {
  // For initialization requests, create a new transport and server
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (req.method === 'POST' && !sessionId) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
    return;
  }

  // For existing sessions, look up the transport
  if (sessionId) {
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: 'Missing mcp-session-id header' });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`MCP server listening on port ${port}`);
});
