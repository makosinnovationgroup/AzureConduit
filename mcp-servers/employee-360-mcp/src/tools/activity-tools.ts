import { z } from 'zod';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

/**
 * Activity Tools - Recent logins, access events, and audit logs
 */

// Schema definitions
export const GetRecentActivitySchema = z.object({
  employee_id: z.string().optional().describe('Employee ID'),
  email: z.string().email().optional().describe('Employee email address'),
  days: z.number().min(1).max(30).optional().default(7).describe('Number of days to look back'),
  include_sign_ins: z.boolean().optional().default(true).describe('Include sign-in events'),
  include_audit_logs: z.boolean().optional().default(true).describe('Include audit log events'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

// Types
export interface SignInEvent {
  id: string;
  timestamp: string;
  userPrincipalName: string;
  appDisplayName: string;
  clientAppUsed?: string;
  deviceDetail?: {
    browser?: string;
    operatingSystem?: string;
    deviceId?: string;
  };
  location?: {
    city?: string;
    state?: string;
    countryOrRegion?: string;
  };
  ipAddress?: string;
  status: 'success' | 'failure' | 'interrupted';
  riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'hidden';
  riskState?: string;
  conditionalAccessStatus?: 'success' | 'failure' | 'notApplied';
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  activityDisplayName: string;
  category: string;
  result: 'success' | 'failure';
  targetResources?: Array<{
    type: string;
    displayName?: string;
    userPrincipalName?: string;
  }>;
  initiatedBy?: {
    user?: {
      displayName?: string;
      userPrincipalName?: string;
    };
    app?: {
      displayName?: string;
    };
  };
}

export interface RecentActivity {
  userId: string;
  userEmail: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  signIns?: {
    events: SignInEvent[];
    summary: {
      totalSignIns: number;
      successfulSignIns: number;
      failedSignIns: number;
      uniqueApps: number;
      uniqueLocations: number;
      riskySessions: number;
    };
  };
  auditLogs?: {
    events: AuditEvent[];
    summary: {
      totalEvents: number;
      byCategory: Record<string, number>;
      successfulEvents: number;
      failedEvents: number;
    };
  };
  securityAlerts?: {
    count: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

// Helper to get Graph client
async function getGraphClient(): Promise<Client> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD configuration is required for activity logs');
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

// Tool implementations
export async function getRecentActivity(
  params: z.infer<typeof GetRecentActivitySchema>
): Promise<RecentActivity> {
  const client = await getGraphClient();
  const identifier = params.email || params.employee_id!;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - params.days);

  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  // Get user ID if email provided
  let userId = identifier;
  let userEmail = identifier;

  if (identifier.includes('@')) {
    try {
      const user = await client.api(`/users/${identifier}`).select(['id', 'userPrincipalName']).get();
      userId = user.id;
      userEmail = user.userPrincipalName;
    } catch {
      // Use identifier as-is
    }
  }

  const result: RecentActivity = {
    userId,
    userEmail,
    period: {
      start: startDateStr,
      end: endDateStr,
      days: params.days,
    },
  };

  // Get sign-in logs
  if (params.include_sign_ins) {
    try {
      const signInResponse = await client
        .api('/auditLogs/signIns')
        .filter(`userPrincipalName eq '${userEmail}' and createdDateTime ge ${startDateStr}`)
        .orderby('createdDateTime desc')
        .top(100)
        .get();

      const events: SignInEvent[] = (signInResponse.value || []).map((signIn: Record<string, unknown>) => ({
        id: signIn.id as string,
        timestamp: signIn.createdDateTime as string,
        userPrincipalName: signIn.userPrincipalName as string,
        appDisplayName: signIn.appDisplayName as string,
        clientAppUsed: signIn.clientAppUsed as string | undefined,
        deviceDetail: signIn.deviceDetail as SignInEvent['deviceDetail'],
        location: signIn.location as SignInEvent['location'],
        ipAddress: signIn.ipAddress as string | undefined,
        status: normalizeSignInStatus(signIn.status as { errorCode?: number }),
        riskLevel: (signIn.riskLevelDuringSignIn || 'none') as SignInEvent['riskLevel'],
        riskState: signIn.riskState as string | undefined,
        conditionalAccessStatus: signIn.conditionalAccessStatus as SignInEvent['conditionalAccessStatus'],
      }));

      // Calculate summary
      const uniqueApps = new Set(events.map((e) => e.appDisplayName));
      const uniqueLocations = new Set(
        events
          .filter((e) => e.location?.city)
          .map((e) => `${e.location!.city}, ${e.location!.countryOrRegion}`)
      );

      result.signIns = {
        events,
        summary: {
          totalSignIns: events.length,
          successfulSignIns: events.filter((e) => e.status === 'success').length,
          failedSignIns: events.filter((e) => e.status === 'failure').length,
          uniqueApps: uniqueApps.size,
          uniqueLocations: uniqueLocations.size,
          riskySessions: events.filter((e) => e.riskLevel && e.riskLevel !== 'none').length,
        },
      };
    } catch (error) {
      console.error('Failed to get sign-in logs:', error);
      // Sign-in logs require specific permissions; may fail
    }
  }

  // Get audit logs
  if (params.include_audit_logs) {
    try {
      const auditResponse = await client
        .api('/auditLogs/directoryAudits')
        .filter(`initiatedBy/user/userPrincipalName eq '${userEmail}' and activityDateTime ge ${startDateStr}`)
        .orderby('activityDateTime desc')
        .top(100)
        .get();

      const events: AuditEvent[] = (auditResponse.value || []).map((audit: Record<string, unknown>) => ({
        id: audit.id as string,
        timestamp: audit.activityDateTime as string,
        activityDisplayName: audit.activityDisplayName as string,
        category: audit.category as string,
        result: (audit.result === 'success' ? 'success' : 'failure') as AuditEvent['result'],
        targetResources: audit.targetResources as AuditEvent['targetResources'],
        initiatedBy: audit.initiatedBy as AuditEvent['initiatedBy'],
      }));

      // Calculate summary
      const byCategory: Record<string, number> = {};
      for (const event of events) {
        byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      }

      result.auditLogs = {
        events,
        summary: {
          totalEvents: events.length,
          byCategory,
          successfulEvents: events.filter((e) => e.result === 'success').length,
          failedEvents: events.filter((e) => e.result === 'failure').length,
        },
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      // Audit logs require specific permissions; may fail
    }
  }

  // Get security alerts (risk detections)
  try {
    const riskResponse = await client
      .api('/identityProtection/riskDetections')
      .filter(`userPrincipalName eq '${userEmail}' and activityDateTime ge ${startDateStr}`)
      .top(50)
      .get();

    const risks = riskResponse.value || [];
    const riskLevels = risks.map((r: Record<string, unknown>) => r.riskLevel as string);

    result.securityAlerts = {
      count: risks.length,
      highRisk: riskLevels.filter((l: string) => l === 'high').length,
      mediumRisk: riskLevels.filter((l: string) => l === 'medium').length,
      lowRisk: riskLevels.filter((l: string) => l === 'low').length,
    };
  } catch {
    // Risk detections require Azure AD P2; may not be available
    result.securityAlerts = {
      count: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
    };
  }

  return result;
}

// Helper function to normalize sign-in status
function normalizeSignInStatus(
  status: { errorCode?: number } | null | undefined
): SignInEvent['status'] {
  if (!status) return 'success';
  if (status.errorCode === 0) return 'success';
  if (status.errorCode === 50140) return 'interrupted'; // Sign-in was interrupted
  return 'failure';
}

// Tool definitions for MCP registration
export const activityTools = [
  {
    name: 'get_recent_activity',
    description:
      'Get recent login activity, audit events, and security alerts for an employee. Useful for security reviews, compliance audits, and investigating suspicious activity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        employee_id: {
          type: 'string',
          description: 'Employee ID',
        },
        email: {
          type: 'string',
          description: 'Employee email address',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back (1-30, default 7)',
        },
        include_sign_ins: {
          type: 'boolean',
          description: 'Include sign-in events (default true)',
        },
        include_audit_logs: {
          type: 'boolean',
          description: 'Include audit log events (default true)',
        },
      },
    },
    handler: getRecentActivity,
    schema: GetRecentActivitySchema,
  },
];
