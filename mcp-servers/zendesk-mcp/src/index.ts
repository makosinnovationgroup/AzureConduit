import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createMcpServer } from './server';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import logger from './utils/logger';

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Create the MCP server
const mcpServer = createMcpServer();

// Store active transports for cleanup
const transports: Map<string, SSEServerTransport> = new Map();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'zendesk-mcp',
    timestamp: new Date().toISOString(),
  });
});

// SSE endpoint for MCP clients to connect
app.get('/sse', async (req: Request, res: Response) => {
  logger.info('New SSE connection');

  const transport = new SSEServerTransport('/messages', res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, transport);

  res.on('close', () => {
    logger.info('SSE connection closed', { sessionId });
    transports.delete(sessionId);
  });

  await mcpServer.connect(transport);
});

// Messages endpoint for MCP client requests
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: 'No active session' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Zendesk MCP server running on port ${PORT}`);
  console.log(`Zendesk MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
