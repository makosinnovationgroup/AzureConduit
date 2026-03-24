import { z } from 'zod';
import { getITAssetConnector, Device, ApplicationAccess, ComplianceStatus } from '../connectors/it-assets';

/**
 * IT Tools - Device and application access management
 */

// Schema definitions
export const GetEmployeeDevicesSchema = z.object({
  employee_id: z.string().optional().describe('Employee ID'),
  email: z.string().email().optional().describe('Employee email address'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

export const GetEmployeeAccessSchema = z.object({
  employee_id: z.string().optional().describe('Employee ID'),
  email: z.string().email().optional().describe('Employee email address'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

export const GetDeviceComplianceSchema = z.object({
  employee_id: z.string().optional().describe('Employee ID'),
  email: z.string().email().optional().describe('Employee email address'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

// Extended types with additional computed fields
export interface DeviceWithStatus extends Device {
  healthScore: 'good' | 'warning' | 'critical';
  daysSinceLastSync?: number;
}

export interface AccessSummary {
  applications: ApplicationAccess[];
  summary: {
    totalApps: number;
    activeApps: number;
    byType: Record<ApplicationAccess['appType'], number>;
    byAccessLevel: Record<string, number>;
  };
}

export interface ComplianceSummary {
  devices: ComplianceStatus[];
  overallCompliance: 'compliant' | 'noncompliant' | 'mixed' | 'unknown';
  summary: {
    totalDevices: number;
    compliantDevices: number;
    nonCompliantDevices: number;
    unknownDevices: number;
    topIssues: string[];
  };
}

// Helper functions
function calculateHealthScore(device: Device): DeviceWithStatus['healthScore'] {
  // Compliance is critical
  if (device.complianceState === 'noncompliant') {
    return 'critical';
  }

  // Check encryption
  if (device.encryptionStatus === 'notEncrypted') {
    return 'critical';
  }

  // Check last sync time
  if (device.lastSyncDateTime) {
    const lastSync = new Date(device.lastSyncDateTime);
    const daysSinceSync = Math.floor(
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSync > 14) return 'critical';
    if (daysSinceSync > 7) return 'warning';
  }

  // Unknown compliance is a warning
  if (device.complianceState === 'unknown') {
    return 'warning';
  }

  return 'good';
}

function calculateDaysSinceSync(lastSyncDateTime?: string): number | undefined {
  if (!lastSyncDateTime) return undefined;
  const lastSync = new Date(lastSyncDateTime);
  if (isNaN(lastSync.getTime())) return undefined;
  return Math.floor((Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24));
}

// Tool implementations
export async function getEmployeeDevices(
  params: z.infer<typeof GetEmployeeDevicesSchema>
): Promise<DeviceWithStatus[]> {
  const itAssetConnector = getITAssetConnector();
  const identifier = params.email || params.employee_id!;

  const devices = await itAssetConnector.getEmployeeDevices(identifier);

  // Enrich devices with health scores
  return devices.map((device) => ({
    ...device,
    healthScore: calculateHealthScore(device),
    daysSinceLastSync: calculateDaysSinceSync(device.lastSyncDateTime),
  }));
}

export async function getEmployeeAccess(
  params: z.infer<typeof GetEmployeeAccessSchema>
): Promise<AccessSummary> {
  const itAssetConnector = getITAssetConnector();
  const identifier = params.email || params.employee_id!;

  const applications = await itAssetConnector.getEmployeeAccess(identifier);

  // Calculate summary
  const byType: Record<ApplicationAccess['appType'], number> = {
    saas: 0,
    onPrem: 0,
    mobile: 0,
    desktop: 0,
  };

  const byAccessLevel: Record<string, number> = {};

  for (const app of applications) {
    byType[app.appType] = (byType[app.appType] || 0) + 1;
    if (app.accessLevel) {
      byAccessLevel[app.accessLevel] = (byAccessLevel[app.accessLevel] || 0) + 1;
    }
  }

  return {
    applications,
    summary: {
      totalApps: applications.length,
      activeApps: applications.filter((a) => a.status === 'active').length,
      byType,
      byAccessLevel,
    },
  };
}

export async function getDeviceCompliance(
  params: z.infer<typeof GetDeviceComplianceSchema>
): Promise<ComplianceSummary> {
  const itAssetConnector = getITAssetConnector();
  const identifier = params.email || params.employee_id!;

  const complianceStatuses = await itAssetConnector.getDeviceCompliance(identifier);

  // Calculate summary
  let compliantDevices = 0;
  let nonCompliantDevices = 0;
  let unknownDevices = 0;
  const issuesCounts: Record<string, number> = {};

  for (const status of complianceStatuses) {
    switch (status.overallStatus) {
      case 'compliant':
        compliantDevices++;
        break;
      case 'noncompliant':
        nonCompliantDevices++;
        // Track issues
        for (const detail of status.complianceDetails) {
          if (detail.state === 'noncompliant') {
            const issueName = detail.policyName || detail.settingName;
            issuesCounts[issueName] = (issuesCounts[issueName] || 0) + 1;
          }
        }
        break;
      default:
        unknownDevices++;
    }
  }

  // Determine overall compliance
  let overallCompliance: ComplianceSummary['overallCompliance'];
  if (complianceStatuses.length === 0) {
    overallCompliance = 'unknown';
  } else if (nonCompliantDevices === 0 && unknownDevices === 0) {
    overallCompliance = 'compliant';
  } else if (compliantDevices === 0) {
    overallCompliance = 'noncompliant';
  } else {
    overallCompliance = 'mixed';
  }

  // Get top issues
  const topIssues = Object.entries(issuesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);

  return {
    devices: complianceStatuses,
    overallCompliance,
    summary: {
      totalDevices: complianceStatuses.length,
      compliantDevices,
      nonCompliantDevices,
      unknownDevices,
      topIssues,
    },
  };
}

// Tool definitions for MCP registration
export const itTools = [
  {
    name: 'get_employee_devices',
    description:
      'Get all devices (laptops, phones, tablets) assigned to an employee with health scores and sync status',
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
      },
    },
    handler: getEmployeeDevices,
    schema: GetEmployeeDevicesSchema,
  },
  {
    name: 'get_employee_access',
    description:
      'Get all applications and systems an employee has access to, with access levels and usage information',
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
      },
    },
    handler: getEmployeeAccess,
    schema: GetEmployeeAccessSchema,
  },
  {
    name: 'get_device_compliance',
    description:
      'Get compliance status for all devices assigned to an employee, including policy violations and remediation status',
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
      },
    },
    handler: getDeviceCompliance,
    schema: GetDeviceComplianceSchema,
  },
];
