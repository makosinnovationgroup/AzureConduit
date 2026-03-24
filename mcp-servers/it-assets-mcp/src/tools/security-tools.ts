import { z } from 'zod';
import { getIntuneConnector, ManagedDevice } from '../connectors/intune';
import { logger } from '../server';

// Schema definitions
export const GetSecurityPostureSchema = z.object({});

export const GetDevicesWithoutEncryptionSchema = z.object({
  os: z.string().optional().describe('Filter by operating system'),
});

export const GetOutdatedOSSchema = z.object({
  os: z.string().optional().describe('Filter by operating system'),
});

export const GetRiskyDevicesSchema = z.object({
  min_risk_factors: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .default(1)
    .describe('Minimum number of risk factors to include device'),
});

// Types
export interface SecurityPosture {
  overallScore: number;
  encryptionCompliance: {
    encrypted: number;
    notEncrypted: number;
    percentage: number;
  };
  complianceStatus: {
    compliant: number;
    nonCompliant: number;
    percentage: number;
  };
  jailbrokenDevices: number;
  stalDevices: number;
  outdatedOSDevices: number;
  totalDevices: number;
  riskCategories: Array<{
    category: string;
    count: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  lastUpdated: string;
}

export interface UnencryptedDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  userDisplayName: string;
  userPrincipalName: string;
  lastSyncDateTime: string;
  complianceState: string;
}

export interface OutdatedOSDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  currentVersion: string;
  minimumVersion: string;
  userDisplayName: string;
  userPrincipalName: string;
  lastSyncDateTime: string;
  versionsBehind: string;
}

export interface RiskyDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  userDisplayName: string;
  userPrincipalName: string;
  riskFactors: string[];
  riskScore: number;
  lastSyncDateTime: string;
}

// Tool implementations

export async function getSecurityPosture(): Promise<SecurityPosture> {
  logger.info('Getting security posture');
  const connector = getIntuneConnector();

  const devices = await connector.getManagedDevices();
  const totalDevices = devices.length;

  // Calculate encryption compliance
  const encryptedDevices = devices.filter((d) => d.isEncrypted === true);
  const notEncryptedDevices = devices.filter((d) => d.isEncrypted === false);

  // Calculate compliance status
  const compliantDevices = devices.filter((d) => d.complianceState === 'compliant');
  const nonCompliantDevices = devices.filter((d) => d.complianceState === 'noncompliant');

  // Count jailbroken devices
  const jailbrokenDevices = devices.filter((d) => d.jailBroken === 'True');

  // Count stale devices (not synced in 30 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const staleDevices = devices.filter((d) => new Date(d.lastSyncDateTime) < cutoffDate);

  // Count outdated OS devices
  const outdatedOSResult = await connector.getDevicesWithOutdatedOS();

  // Build risk categories
  const riskCategories = [
    {
      category: 'Unencrypted Devices',
      count: notEncryptedDevices.length,
      severity: 'critical' as const,
    },
    {
      category: 'Jailbroken/Rooted Devices',
      count: jailbrokenDevices.length,
      severity: 'critical' as const,
    },
    {
      category: 'Non-Compliant Devices',
      count: nonCompliantDevices.length,
      severity: 'high' as const,
    },
    {
      category: 'Outdated OS',
      count: outdatedOSResult.length,
      severity: 'high' as const,
    },
    {
      category: 'Stale Devices (30+ days)',
      count: staleDevices.length,
      severity: 'medium' as const,
    },
  ].filter((r) => r.count > 0);

  // Calculate overall security score (0-100)
  // Weighted factors: encryption (30%), compliance (30%), jailbreak (20%), OS currency (10%), staleness (10%)
  let score = 100;

  const encryptionRate = totalDevices > 0 ? encryptedDevices.length / totalDevices : 1;
  const complianceRate = totalDevices > 0 ? compliantDevices.length / totalDevices : 1;
  const noJailbreakRate = totalDevices > 0 ? 1 - jailbrokenDevices.length / totalDevices : 1;
  const currentOSRate = totalDevices > 0 ? 1 - outdatedOSResult.length / totalDevices : 1;
  const activeRate = totalDevices > 0 ? 1 - staleDevices.length / totalDevices : 1;

  score =
    Math.round(
      encryptionRate * 30 +
        complianceRate * 30 +
        noJailbreakRate * 20 +
        currentOSRate * 10 +
        activeRate * 10
    );

  return {
    overallScore: score,
    encryptionCompliance: {
      encrypted: encryptedDevices.length,
      notEncrypted: notEncryptedDevices.length,
      percentage:
        totalDevices > 0 ? Math.round((encryptedDevices.length / totalDevices) * 100) : 0,
    },
    complianceStatus: {
      compliant: compliantDevices.length,
      nonCompliant: nonCompliantDevices.length,
      percentage:
        totalDevices > 0 ? Math.round((compliantDevices.length / totalDevices) * 100) : 0,
    },
    jailbrokenDevices: jailbrokenDevices.length,
    stalDevices: staleDevices.length,
    outdatedOSDevices: outdatedOSResult.length,
    totalDevices,
    riskCategories,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getDevicesWithoutEncryption(
  params: z.infer<typeof GetDevicesWithoutEncryptionSchema>
): Promise<UnencryptedDevice[]> {
  const { os } = params;
  logger.info('Getting devices without encryption', { os });

  const connector = getIntuneConnector();
  let devices = await connector.getDevicesWithoutEncryption();

  if (os) {
    devices = devices.filter(
      (d) => d.operatingSystem?.toLowerCase() === os.toLowerCase()
    );
  }

  const results: UnencryptedDevice[] = devices.map((device) => ({
    id: device.id,
    deviceName: device.deviceName,
    operatingSystem: device.operatingSystem,
    osVersion: device.osVersion,
    userDisplayName: device.userDisplayName,
    userPrincipalName: device.userPrincipalName,
    lastSyncDateTime: device.lastSyncDateTime,
    complianceState: device.complianceState,
  }));

  logger.info('Retrieved unencrypted devices', { count: results.length });
  return results;
}

export async function getOutdatedOS(
  params: z.infer<typeof GetOutdatedOSSchema>
): Promise<OutdatedOSDevice[]> {
  const { os } = params;
  logger.info('Getting devices with outdated OS', { os });

  const connector = getIntuneConnector();
  let outdatedDevices = await connector.getDevicesWithOutdatedOS();

  if (os) {
    outdatedDevices = outdatedDevices.filter(
      (d) => d.device.operatingSystem?.toLowerCase() === os.toLowerCase()
    );
  }

  // Minimum version requirements (these should be configurable in production)
  const minVersions: Record<string, string> = {
    Windows: '10.0.19044',
    iOS: '16.0',
    macOS: '13.0',
    Android: '12.0',
  };

  const results: OutdatedOSDevice[] = outdatedDevices.map((item) => {
    const minVersion = minVersions[item.device.operatingSystem] || 'Unknown';

    return {
      id: item.device.id,
      deviceName: item.device.deviceName,
      operatingSystem: item.device.operatingSystem,
      currentVersion: item.currentVersion,
      minimumVersion: minVersion,
      userDisplayName: item.device.userDisplayName,
      userPrincipalName: item.device.userPrincipalName,
      lastSyncDateTime: item.device.lastSyncDateTime,
      versionsBehind: item.issue,
    };
  });

  logger.info('Retrieved outdated OS devices', { count: results.length });
  return results;
}

export async function getRiskyDevices(
  params: z.infer<typeof GetRiskyDevicesSchema>
): Promise<RiskyDevice[]> {
  const { min_risk_factors } = params;
  logger.info('Getting risky devices', { min_risk_factors });

  const connector = getIntuneConnector();
  const riskyDevices = await connector.getRiskyDevices();

  const results: RiskyDevice[] = riskyDevices
    .filter((item) => item.risks.length >= min_risk_factors)
    .map((item) => ({
      id: item.device.id,
      deviceName: item.device.deviceName,
      operatingSystem: item.device.operatingSystem,
      userDisplayName: item.device.userDisplayName,
      userPrincipalName: item.device.userPrincipalName,
      riskFactors: item.risks,
      riskScore: calculateRiskScore(item.risks),
      lastSyncDateTime: item.device.lastSyncDateTime,
    }))
    .sort((a, b) => b.riskScore - a.riskScore);

  logger.info('Retrieved risky devices', { count: results.length });
  return results;
}

function calculateRiskScore(risks: string[]): number {
  // Weight different risk factors
  const riskWeights: Record<string, number> = {
    jailbroken: 40,
    rooted: 40,
    'not encrypted': 30,
    'non-compliant': 25,
    'management state': 15,
    'last sync': 10,
  };

  let score = 0;
  for (const risk of risks) {
    const riskLower = risk.toLowerCase();
    for (const [keyword, weight] of Object.entries(riskWeights)) {
      if (riskLower.includes(keyword)) {
        score += weight;
        break;
      }
    }
    // Default weight for unknown risks
    if (score === 0) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

// Tool definitions for MCP registration
export const securityTools = [
  {
    name: 'get_security_posture',
    description:
      'Get overall security posture score and breakdown including encryption compliance, device compliance, jailbroken devices, outdated OS, and stale devices. Key metric for IT security dashboards.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getSecurityPosture,
    schema: GetSecurityPostureSchema,
  },
  {
    name: 'get_devices_without_encryption',
    description:
      'Get all devices that do not have disk encryption enabled. Critical security risk that should be remediated immediately.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        os: {
          type: 'string',
          description: 'Filter by operating system (e.g., Windows, iOS, Android, macOS)',
        },
      },
    },
    handler: getDevicesWithoutEncryption,
    schema: GetDevicesWithoutEncryptionSchema,
  },
  {
    name: 'get_outdated_os',
    description:
      'Get devices running outdated operating system versions that may have security vulnerabilities. Includes current version and minimum recommended version.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        os: {
          type: 'string',
          description: 'Filter by operating system (e.g., Windows, iOS, Android, macOS)',
        },
      },
    },
    handler: getOutdatedOS,
    schema: GetOutdatedOSSchema,
  },
  {
    name: 'get_risky_devices',
    description:
      'Get devices with security risk flags such as jailbroken status, missing encryption, non-compliance, or stale sync. Returns risk score and detailed risk factors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        min_risk_factors: {
          type: 'number',
          description: 'Minimum number of risk factors to include device (1-5, default 1)',
        },
      },
    },
    handler: getRiskyDevices,
    schema: GetRiskyDevicesSchema,
  },
];
