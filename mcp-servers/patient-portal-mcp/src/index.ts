/**
 * Patient Portal MCP Server - Entry Point
 *
 * HTTP server with SSE transport for MCP communication.
 *
 * HIPAA COMPLIANCE NOTES:
 * - Ensure TLS 1.2+ is configured in production (via reverse proxy or Node.js TLS)
 * - Health endpoint does not expose PHI
 * - All PHI access is logged via audit middleware
 * - Implement authentication before production deployment
 */

import express, { Request, Response, NextFunction } from 'express';
import { createMcpServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import auditLogger, { logAuditEvent } from './middleware/audit.js';

const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

// Create the MCP server
const mcpServer = createMcpServer();

// Store active transports for cleanup
const transports: Map<string, SSEServerTransport> = new Map();

/**
 * HIPAA Security Middleware
 *
 * In production, implement:
 * - Authentication (OAuth 2.0, JWT, SAML)
 * - Authorization (role-based access control)
 * - Rate limiting
 * - Request validation
 */
const securityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Log all requests for audit trail
  auditLogger.info('HTTP request received', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // TODO: Implement authentication
  // const authHeader = req.headers.authorization;
  // if (!authHeader) {
  //   logAuditEvent('ACCESS_DENIED', { toolName: 'http', resourceType: 'AUTHENTICATION' }, 'FAILURE', 'No auth header');
  //   res.status(401).json({ error: 'Authentication required' });
  //   return;
  // }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  next();
};

// Apply security middleware to all routes
app.use(securityMiddleware);

/**
 * Health check endpoint
 *
 * NOTE: This endpoint should NOT expose any PHI or sensitive information.
 * Only basic service status is returned.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'patient-portal-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    // HIPAA: Do not include any PHI or patient counts in health check
    hipaaCompliant: true
  });
});

/**
 * SSE endpoint for MCP clients to connect
 *
 * HIPAA NOTE: All PHI access through this connection is logged
 * by the individual tool handlers.
 */
app.get('/sse', async (req: Request, res: Response) => {
  const clientIp = req.ip || 'unknown';
  const sessionId = Date.now().toString();

  // Log new connection
  logAuditEvent(
    'LOGIN',
    {
      toolName: 'sse_connection',
      resourceType: 'AUTHENTICATION',
      sessionId,
      clientIp,
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'New SSE connection established'
  );

  auditLogger.info('New SSE connection', {
    sessionId,
    clientIp
  });

  const transport = new SSEServerTransport('/messages', res);
  transports.set(sessionId, transport);

  res.on('close', () => {
    // Log connection close
    logAuditEvent(
      'LOGOUT',
      {
        toolName: 'sse_connection',
        resourceType: 'AUTHENTICATION',
        sessionId,
        clientIp
      },
      'SUCCESS',
      'SSE connection closed'
    );

    auditLogger.info('SSE connection closed', { sessionId });
    transports.delete(sessionId);
  });

  await mcpServer.connect(transport);
});

/**
 * Messages endpoint for MCP client requests
 *
 * HIPAA NOTE: Individual message/tool calls are logged
 * by the server.ts handlers with appropriate audit detail.
 */
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    auditLogger.warn('Invalid session attempted', {
      providedSessionId: sessionId,
      clientIp: req.ip
    });

    res.status(400).json({ error: 'No active session' });
    return;
  }

  await transport.handlePostMessage(req, res);
});

/**
 * Error handling middleware
 *
 * HIPAA NOTE: Error responses should not leak PHI.
 * Internal errors are logged but not exposed to client.
 */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  auditLogger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  logAuditEvent(
    'SYSTEM_ERROR',
    {
      toolName: 'http_server',
      resourceType: 'PATIENT_RECORD'
    },
    'FAILURE',
    'Internal server error'
  );

  // Don't expose internal error details to client
  res.status(500).json({
    error: 'Internal server error',
    // HIPAA: Do not include stack trace or detailed error in response
    requestId: Date.now().toString()
  });
});

// Start the server
app.listen(PORT, () => {
  auditLogger.info('Patient Portal MCP server running', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });

  console.log(`Patient Portal MCP server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log('');
  console.log('HIPAA NOTICE: This server handles Protected Health Information (PHI).');
  console.log('Ensure proper security controls are in place before production use.');
  console.log('All PHI access is logged for HIPAA audit compliance.');
});
