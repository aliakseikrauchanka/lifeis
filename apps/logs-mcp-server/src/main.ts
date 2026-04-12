import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ApiClient } from './api-client';

const token = process.env.LIFEIS_ACCESS_TOKEN;
const backendUrl = process.env.LIFEIS_BACKEND_URL || 'http://localhost:4202';

if (!token) {
  console.error('LIFEIS_ACCESS_TOKEN is required');
  process.exit(1);
}

const api = new ApiClient(backendUrl, token);

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
