import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ApiClient } from './api-client';
import { randomUUID } from 'node:crypto';
import express from 'express';

const serviceApiKey = process.env.SERVICE_API_KEY;
const backendUrl = process.env.LIFEIS_BACKEND_URL || 'http://localhost:4202';
// const backendUrl = 'http://entry-server:3000';
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
    name: 'lifeis-logs',
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
