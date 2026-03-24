import express, { Request, Response } from 'express';
import { createMcpServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Create the MCP server
const mcpServer = createMcpServer();

// Store active transports for cleanup
const transports: Map<string, SSEServerTransport> = new Map();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const status = {
    status: 'healthy',
    server: 'employee-360-mcp',
    version: '1.0.0',
    description: 'Cross-system employee data aggregation server',
    connectors: {
      hr: {
        type: process.env.HR_SYSTEM_TYPE || 'generic',
        configured: !!(process.env.HR_API_URL || process.env.HR_API_KEY),
      },
      directory: {
        type: 'azure-ad',
        configured: !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID),
      },
      itAssets: {
        type: process.env.IT_ASSET_SYSTEM_TYPE || 'intune',
        configured: !!(process.env.AZURE_TENANT_ID || process.env.SERVICENOW_URL),
      },
    },
    tools: [
      // Employee 360 tools
      'get_employee_360',
      'search_employees',
      'get_org_chart',
      // HR tools
      'get_employee_hr',
      'get_direct_reports',
      'get_team_members',
      // IT tools
      'get_employee_devices',
      'get_employee_access',
      'get_device_compliance',
      // Activity tools
      'get_recent_activity',
    ],
    timestamp: new Date().toISOString(),
  };
  res.json(status);
});

// SSE endpoint for MCP clients to connect
app.get('/sse', async (req: Request, res: Response) => {
  console.log('New SSE connection');

  const transport = new SSEServerTransport('/messages', res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, transport);

  res.on('close', () => {
    console.log('SSE connection closed');
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
  console.log(`Employee 360 MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log('');
  console.log('Available tools:');
  console.log('  - get_employee_360: Complete 360 view of an employee');
  console.log('  - search_employees: Search across HR and directory');
  console.log('  - get_org_chart: Get org structure from a manager');
  console.log('  - get_employee_hr: HR details (title, dept, PTO, etc.)');
  console.log('  - get_direct_reports: List direct reports');
  console.log('  - get_team_members: List team/department members');
  console.log('  - get_employee_devices: Assigned devices and health');
  console.log('  - get_employee_access: Application access list');
  console.log('  - get_device_compliance: Device compliance status');
  console.log('  - get_recent_activity: Login and audit events');
});
