import { z } from 'zod';
import { getIntuneConnector, ManagedDevice } from '../connectors/intune';
import { logger } from '../server';

// Schema definitions
export const GetDeviceSummarySchema = z.object({});

export const ListDevicesSchema = z.object({
  os: z.string().optional().describe('Filter by operating system (e.g., Windows, iOS, Android, macOS)'),
  compliance: z.enum(['compliant', 'noncompliant', 'unknown']).optional().describe('Filter by compliance state'),
  user: z.string().optional().describe('Filter by user email or display name'),
  limit: z.number().min(1).max(500).optional().default(100).describe('Maximum number of devices to return'),
});

export const GetDeviceSchema = z.object({
  device_id: z.string().min(1).describe('The Intune managed device ID'),
});

export const GetNonCompliantDevicesSchema = z.object({
  include_reasons: z.boolean().optional().default(true).describe('Include compliance failure reasons'),
});

export const GetStaleDevicesSchema = z.object({
  days: z.number().min(1).max(365).optional().default(30).describe('Number of days since last sync to consider stale'),
});

// Types
export interface DeviceSummary {
  total: number;
  byOS: Record<string, number>;
  byComplianceState: Record<string, number>;
  byManagementState: Record<string, number>;
  lastUpdated: string;
}

export interface NonCompliantDevice {
  device: ManagedDevice;
  reasons: string[];
}

export interface StaleDevice {
  device: ManagedDevice;
  daysSinceSync: number;
  lastSyncDateTime: string;
}

// Tool implementations

export async function getDeviceSummary(): Promise<DeviceSummary> {
  logger.info('Getting device summary');
  const connector = getIntuneConnector();
  const summary = await connector.getDeviceSummary();

  return {
    ...summary,
    lastUpdated: new Date().toISOString(),
  };
}

export async function listDevices(
  params: z.infer<typeof ListDevicesSchema>
): Promise<ManagedDevice[]> {
  const { os, compliance, user, limit } = params;
  logger.info('Listing devices', { os, compliance, user, limit });

  const connector = getIntuneConnector();
  let devices = await connector.getManagedDevices();

  // Apply filters
  if (os) {
    devices = devices.filter(
      (d) => d.operatingSystem?.toLowerCase() === os.toLowerCase()
    );
  }

  if (compliance) {
    devices = devices.filter(
      (d) => d.complianceState?.toLowerCase() === compliance.toLowerCase()
    );
  }

  if (user) {
    const userLower = user.toLowerCase();
    devices = devices.filter(
      (d) =>
        d.userPrincipalName?.toLowerCase().includes(userLower) ||
        d.userDisplayName?.toLowerCase().includes(userLower) ||
        d.emailAddress?.toLowerCase().includes(userLower)
    );
  }

  // Apply limit
  const limitedDevices = devices.slice(0, limit);

  logger.info('Listed devices', { total: devices.length, returned: limitedDevices.length });
  return limitedDevices;
}

export async function getDevice(
  params: z.infer<typeof GetDeviceSchema>
): Promise<ManagedDevice | { error: string }> {
  const { device_id } = params;
  logger.info('Getting device details', { device_id });

  const connector = getIntuneConnector();
  const device = await connector.getManagedDevice(device_id);

  if (!device) {
    return { error: `Device not found: ${device_id}` };
  }

  logger.info('Retrieved device', { device_id, deviceName: device.deviceName });
  return device;
}

export async function getNonCompliantDevices(
  params: z.infer<typeof GetNonCompliantDevicesSchema>
): Promise<NonCompliantDevice[]> {
  const { include_reasons } = params;
  logger.info('Getting non-compliant devices', { include_reasons });

  const connector = getIntuneConnector();
  const devices = await connector.getNonCompliantDevices();

  const results: NonCompliantDevice[] = [];

  for (const device of devices) {
    const reasons: string[] = [];

    if (include_reasons) {
      // Get compliance policy states for this device
      try {
        const policyStates = await connector.getDeviceCompliancePolicyStates(device.id);

        for (const policyState of policyStates) {
          if (policyState.state !== 'compliant') {
            for (const setting of policyState.settingStates || []) {
              if (setting.state !== 'compliant' && setting.settingName) {
                reasons.push(`${policyState.displayName}: ${setting.settingName} - ${setting.state}`);
              }
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to get compliance reasons for device', { deviceId: device.id, error });
        reasons.push('Unable to retrieve detailed compliance reasons');
      }
    }

    results.push({
      device,
      reasons: reasons.length > 0 ? reasons : ['Non-compliant (details unavailable)'],
    });
  }

  logger.info('Retrieved non-compliant devices', { count: results.length });
  return results;
}

export async function getStaleDevices(
  params: z.infer<typeof GetStaleDevicesSchema>
): Promise<StaleDevice[]> {
  const { days } = params;
  logger.info('Getting stale devices', { days });

  const connector = getIntuneConnector();
  const devices = await connector.getStaleDevices(days);

  const results: StaleDevice[] = devices.map((device) => {
    const lastSync = new Date(device.lastSyncDateTime);
    const daysSinceSync = Math.floor(
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      device,
      daysSinceSync,
      lastSyncDateTime: device.lastSyncDateTime,
    };
  });

  // Sort by days since sync (most stale first)
  results.sort((a, b) => b.daysSinceSync - a.daysSinceSync);

  logger.info('Retrieved stale devices', { count: results.length, daysThreshold: days });
  return results;
}

// Tool definitions for MCP registration
export const deviceTools = [
  {
    name: 'get_device_summary',
    description:
      'Get a summary of all managed devices including totals by OS, compliance status, and management state. Useful for IT dashboard KPIs.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getDeviceSummary,
    schema: GetDeviceSummarySchema,
  },
  {
    name: 'list_devices',
    description:
      'List managed devices with optional filters for OS, compliance state, and user. Returns device details including name, OS, compliance, and user assignment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        os: {
          type: 'string',
          description: 'Filter by operating system (e.g., Windows, iOS, Android, macOS)',
        },
        compliance: {
          type: 'string',
          enum: ['compliant', 'noncompliant', 'unknown'],
          description: 'Filter by compliance state',
        },
        user: {
          type: 'string',
          description: 'Filter by user email or display name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of devices to return (1-500, default 100)',
        },
      },
    },
    handler: listDevices,
    schema: ListDevicesSchema,
  },
  {
    name: 'get_device',
    description:
      'Get detailed information about a specific managed device by its Intune device ID. Includes hardware details, compliance state, encryption status, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        device_id: {
          type: 'string',
          description: 'The Intune managed device ID',
        },
      },
      required: ['device_id'],
    },
    handler: getDevice,
    schema: GetDeviceSchema,
  },
  {
    name: 'get_noncompliant_devices',
    description:
      'Get all non-compliant devices with their compliance failure reasons. Helps identify devices that need attention for security or policy violations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_reasons: {
          type: 'boolean',
          description: 'Include detailed compliance failure reasons (default: true)',
        },
      },
    },
    handler: getNonCompliantDevices,
    schema: GetNonCompliantDevicesSchema,
  },
  {
    name: 'get_stale_devices',
    description:
      'Get devices that have not synced with Intune in the specified number of days. Helps identify potentially lost, stolen, or abandoned devices.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days since last sync to consider stale (1-365, default 30)',
        },
      },
    },
    handler: getStaleDevices,
    schema: GetStaleDevicesSchema,
  },
];
