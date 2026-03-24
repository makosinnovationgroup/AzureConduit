/**
 * HIPAA Audit Logging Middleware
 *
 * HIPAA COMPLIANCE REQUIREMENTS:
 * - All access to Protected Health Information (PHI) must be logged
 * - Audit logs must include: who, what, when, where, why
 * - Logs must be tamper-evident and retained for 6 years minimum
 * - Must capture both successful and failed access attempts
 *
 * WARNING: This audit log may contain PHI identifiers. Ensure audit log
 * storage meets HIPAA security requirements (encryption at rest, access controls).
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// HIPAA-required audit event types
export type AuditEventType =
  | 'PHI_ACCESS'
  | 'PHI_CREATE'
  | 'PHI_UPDATE'
  | 'PHI_DELETE'
  | 'PHI_EXPORT'
  | 'PHI_SEARCH'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ACCESS_DENIED'
  | 'SYSTEM_ERROR';

// HIPAA-required audit event categories
export type AuditCategory =
  | 'PATIENT_RECORD'
  | 'APPOINTMENT'
  | 'MEDICATION'
  | 'LAB_RESULT'
  | 'BILLING'
  | 'CLINICAL_NOTE'
  | 'ALLERGY'
  | 'AUTHENTICATION';

export interface AuditContext {
  // Who - Identity of the user/system accessing PHI
  userId?: string;
  userRole?: string;
  sessionId?: string;
  clientIp?: string;

  // What - The resource being accessed
  resourceType: AuditCategory;
  resourceId?: string;
  patientId?: string;

  // Why - Purpose of access (required for HIPAA)
  purposeOfUse?: string;

  // Additional context
  toolName: string;
  parameters?: Record<string, unknown>;
}

export interface AuditLogEntry {
  // Unique identifier for this audit event
  auditId: string;

  // When - Timestamp in ISO 8601 format
  timestamp: string;

  // Event classification
  eventType: AuditEventType;
  category: AuditCategory;

  // Who accessed
  userId: string;
  userRole: string;
  sessionId: string;
  clientIp: string;

  // What was accessed
  resourceType: string;
  resourceId: string;
  patientId: string;

  // How - The tool/action used
  toolName: string;
  action: string;

  // Why - Purpose of use (Treatment, Payment, Operations, etc.)
  purposeOfUse: string;

  // Outcome
  outcome: 'SUCCESS' | 'FAILURE';
  outcomeDescription?: string;

  // Request details (sanitized - no PHI in parameters)
  requestId: string;
  parameters: Record<string, unknown>;

  // Server identification
  serverName: string;
  serverVersion: string;
}

// Create a dedicated audit logger
// IMPORTANT: In production, this should write to a HIPAA-compliant
// audit log storage system (e.g., immutable cloud storage, SIEM)
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'patient-portal-mcp',
    logType: 'HIPAA_AUDIT'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
    // PRODUCTION: Add secure file transport or external audit service
    // new winston.transports.File({
    //   filename: '/var/log/hipaa-audit/audit.log',
    //   maxsize: 100 * 1024 * 1024, // 100MB
    //   maxFiles: 365 * 6, // 6 years retention
    //   tailable: true
    // })
  ]
});

/**
 * Sanitize parameters to remove or mask PHI before logging
 * HIPAA Consideration: Audit logs should identify WHAT was accessed,
 * not contain the actual PHI data itself.
 */
function sanitizeParameters(params: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!params) return {};

  const sanitized: Record<string, unknown> = {};
  const sensitiveFields = ['ssn', 'social_security', 'dob', 'date_of_birth', 'address', 'phone', 'email'];

  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();

    // Mask sensitive fields
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 100) {
      // Truncate long strings that might contain PHI
      sanitized[key] = value.substring(0, 50) + '...[TRUNCATED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log a HIPAA audit event
 * This MUST be called for every PHI access attempt
 */
export function logAuditEvent(
  eventType: AuditEventType,
  context: AuditContext,
  outcome: 'SUCCESS' | 'FAILURE',
  outcomeDescription?: string
): string {
  const auditId = uuidv4();
  const requestId = uuidv4();

  const entry: AuditLogEntry = {
    auditId,
    timestamp: new Date().toISOString(),
    eventType,
    category: context.resourceType,
    userId: context.userId || 'SYSTEM',
    userRole: context.userRole || 'UNKNOWN',
    sessionId: context.sessionId || 'NO_SESSION',
    clientIp: context.clientIp || 'UNKNOWN',
    resourceType: context.resourceType,
    resourceId: context.resourceId || 'N/A',
    patientId: context.patientId || 'N/A',
    toolName: context.toolName,
    action: `${context.toolName}:${eventType}`,
    purposeOfUse: context.purposeOfUse || 'TREATMENT',
    outcome,
    outcomeDescription,
    requestId,
    parameters: sanitizeParameters(context.parameters),
    serverName: 'patient-portal-mcp',
    serverVersion: '1.0.0'
  };

  // Log the audit event
  auditLogger.info('HIPAA_AUDIT_EVENT', entry);

  return auditId;
}

/**
 * Create an audit wrapper for tool functions
 * Automatically logs access attempts before and outcomes after execution
 */
export function withAuditLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  toolName: string,
  resourceType: AuditCategory,
  fn: T,
  getPatientId: (args: unknown[]) => string | undefined
): T {
  return (async (...args: unknown[]) => {
    const patientId = getPatientId(args);
    const context: AuditContext = {
      toolName,
      resourceType,
      patientId,
      resourceId: patientId,
      parameters: args[0] as Record<string, unknown>,
      purposeOfUse: 'TREATMENT' // Default purpose
    };

    // Log the access attempt
    const auditId = logAuditEvent('PHI_ACCESS', context, 'SUCCESS');

    try {
      const result = await fn(...args);

      // Log successful access
      logAuditEvent('PHI_ACCESS', { ...context, resourceId: auditId }, 'SUCCESS', 'Data retrieved successfully');

      return result;
    } catch (error) {
      // Log failed access
      logAuditEvent(
        'PHI_ACCESS',
        { ...context, resourceId: auditId },
        'FAILURE',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }) as T;
}

/**
 * Convenience function for logging PHI search operations
 * Searches are particularly sensitive and must be logged with query details
 */
export function logSearchAudit(
  toolName: string,
  searchQuery: string,
  resultCount: number,
  patientIdsReturned: string[]
): void {
  logAuditEvent(
    'PHI_SEARCH',
    {
      toolName,
      resourceType: 'PATIENT_RECORD',
      parameters: {
        query: searchQuery,
        resultCount,
        // Log which patient records were returned (IDs only, no PHI)
        patientIdsReturned: patientIdsReturned.slice(0, 10) // Limit to first 10
      }
    },
    'SUCCESS',
    `Search returned ${resultCount} results`
  );
}

/**
 * Log access denied events (required for HIPAA)
 */
export function logAccessDenied(
  toolName: string,
  resourceType: AuditCategory,
  patientId: string | undefined,
  reason: string,
  context?: Partial<AuditContext>
): void {
  logAuditEvent(
    'ACCESS_DENIED',
    {
      toolName,
      resourceType,
      patientId,
      ...context
    },
    'FAILURE',
    reason
  );
}

export default auditLogger;
