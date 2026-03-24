import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { logger } from '../server';

export interface IntuneConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface ManagedDevice {
  id: string;
  deviceName: string;
  managedDeviceOwnerType: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  operatingSystem: string;
  complianceState: string;
  jailBroken: string;
  managementAgent: string;
  osVersion: string;
  azureADDeviceId: string;
  azureADRegistered: boolean;
  deviceEnrollmentType: string;
  activationLockBypassCode: string | null;
  emailAddress: string;
  userDisplayName: string;
  userPrincipalName: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  isEncrypted: boolean;
  isSupervised: boolean;
  freeStorageSpaceInBytes: number;
  totalStorageSpaceInBytes: number;
  deviceRegistrationState: string;
  managementState: string;
}

export interface CompliancePolicy {
  id: string;
  displayName: string;
  description: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  version: number;
}

export interface DeviceCompliancePolicyState {
  id: string;
  settingStates: Array<{
    setting: string;
    settingName: string;
    state: string;
    errorCode: number;
    errorDescription: string;
  }>;
  displayName: string;
  state: string;
  policyId: string;
}

export class IntuneConnector {
  private client: Client | null = null;
  private config: IntuneConfig;
  private isConnected: boolean = false;

  constructor(config: IntuneConfig) {
    this.config = config;
  }

  async connect(): Promise<Client> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    logger.info('Connecting to Microsoft Intune via Graph API...');

    try {
      const credential = new ClientSecretCredential(
        this.config.tenantId,
        this.config.clientId,
        this.config.clientSecret
      );

      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default'],
      });

      this.client = Client.initWithMiddleware({
        authProvider,
      });

      // Test connection by fetching organization info
      await this.client.api('/organization').get();

      this.isConnected = true;
      logger.info('Successfully connected to Microsoft Intune');

      return this.client;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Microsoft Intune', { error });
      throw error;
    }
  }

  async getClient(): Promise<Client> {
    if (!this.client || !this.isConnected) {
      return this.connect();
    }
    return this.client;
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  // Device Management Methods

  async getManagedDevices(filter?: string): Promise<ManagedDevice[]> {
    const client = await this.getClient();
    let request = client.api('/deviceManagement/managedDevices');

    if (filter) {
      request = request.filter(filter);
    }

    const response = await request.get();
    return response.value || [];
  }

  async getManagedDevice(deviceId: string): Promise<ManagedDevice | null> {
    const client = await this.getClient();
    try {
      const device = await client.api(`/deviceManagement/managedDevices/${deviceId}`).get();
      return device;
    } catch (error) {
      logger.warn('Device not found', { deviceId });
      return null;
    }
  }

  async getDevicesByOS(os: string): Promise<ManagedDevice[]> {
    const filter = `operatingSystem eq '${os}'`;
    return this.getManagedDevices(filter);
  }

  async getNonCompliantDevices(): Promise<ManagedDevice[]> {
    const filter = "complianceState eq 'noncompliant'";
    return this.getManagedDevices(filter);
  }

  async getStaleDevices(daysInactive: number): Promise<ManagedDevice[]> {
    const devices = await this.getManagedDevices();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    return devices.filter((device) => {
      const lastSync = new Date(device.lastSyncDateTime);
      return lastSync < cutoffDate;
    });
  }

  async getDeviceSummary(): Promise<{
    total: number;
    byOS: Record<string, number>;
    byComplianceState: Record<string, number>;
    byManagementState: Record<string, number>;
  }> {
    const devices = await this.getManagedDevices();

    const byOS: Record<string, number> = {};
    const byComplianceState: Record<string, number> = {};
    const byManagementState: Record<string, number> = {};

    for (const device of devices) {
      // Count by OS
      const os = device.operatingSystem || 'Unknown';
      byOS[os] = (byOS[os] || 0) + 1;

      // Count by compliance state
      const compliance = device.complianceState || 'Unknown';
      byComplianceState[compliance] = (byComplianceState[compliance] || 0) + 1;

      // Count by management state
      const management = device.managementState || 'Unknown';
      byManagementState[management] = (byManagementState[management] || 0) + 1;
    }

    return {
      total: devices.length,
      byOS,
      byComplianceState,
      byManagementState,
    };
  }

  // Compliance Policy Methods

  async getCompliancePolicies(): Promise<CompliancePolicy[]> {
    const client = await this.getClient();
    const response = await client.api('/deviceManagement/deviceCompliancePolicies').get();
    return response.value || [];
  }

  async getDeviceCompliancePolicyStates(deviceId: string): Promise<DeviceCompliancePolicyState[]> {
    const client = await this.getClient();
    const response = await client
      .api(`/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates`)
      .get();
    return response.value || [];
  }

  async getComplianceByPolicy(): Promise<
    Array<{
      policyId: string;
      policyName: string;
      compliant: number;
      nonCompliant: number;
      error: number;
      unknown: number;
    }>
  > {
    const client = await this.getClient();
    const policies = await this.getCompliancePolicies();
    const results = [];

    for (const policy of policies) {
      try {
        const summary = await client
          .api(`/deviceManagement/deviceCompliancePolicies/${policy.id}/deviceStatuses`)
          .get();

        let compliant = 0;
        let nonCompliant = 0;
        let error = 0;
        let unknown = 0;

        for (const status of summary.value || []) {
          switch (status.status) {
            case 'compliant':
              compliant++;
              break;
            case 'nonCompliant':
              nonCompliant++;
              break;
            case 'error':
              error++;
              break;
            default:
              unknown++;
          }
        }

        results.push({
          policyId: policy.id,
          policyName: policy.displayName,
          compliant,
          nonCompliant,
          error,
          unknown,
        });
      } catch (error) {
        logger.warn('Failed to get compliance for policy', { policyId: policy.id, error });
      }
    }

    return results;
  }

  // Security Methods

  async getDevicesWithoutEncryption(): Promise<ManagedDevice[]> {
    const devices = await this.getManagedDevices();
    return devices.filter((device) => device.isEncrypted === false);
  }

  async getDevicesWithOutdatedOS(): Promise<
    Array<{
      device: ManagedDevice;
      currentVersion: string;
      issue: string;
    }>
  > {
    const devices = await this.getManagedDevices();
    const results = [];

    // Define minimum acceptable OS versions (example thresholds)
    const minVersions: Record<string, string> = {
      Windows: '10.0.19044', // Windows 10 21H2
      iOS: '16.0',
      macOS: '13.0',
      Android: '12.0',
    };

    for (const device of devices) {
      const os = device.operatingSystem;
      const version = device.osVersion;

      if (os && version && minVersions[os]) {
        if (this.compareVersions(version, minVersions[os]) < 0) {
          results.push({
            device,
            currentVersion: version,
            issue: `OS version ${version} is below minimum ${minVersions[os]}`,
          });
        }
      }
    }

    return results;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  async getRiskyDevices(): Promise<
    Array<{
      device: ManagedDevice;
      risks: string[];
    }>
  > {
    const devices = await this.getManagedDevices();
    const results = [];

    for (const device of devices) {
      const risks: string[] = [];

      if (device.jailBroken === 'True') {
        risks.push('Device is jailbroken/rooted');
      }

      if (device.complianceState === 'noncompliant') {
        risks.push('Device is non-compliant');
      }

      if (!device.isEncrypted) {
        risks.push('Device is not encrypted');
      }

      if (device.managementState !== 'managed') {
        risks.push(`Management state: ${device.managementState}`);
      }

      // Check for old sync
      const lastSync = new Date(device.lastSyncDateTime);
      const daysSinceSync = Math.floor(
        (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceSync > 14) {
        risks.push(`Last sync ${daysSinceSync} days ago`);
      }

      if (risks.length > 0) {
        results.push({ device, risks });
      }
    }

    return results;
  }
}

let intuneConnector: IntuneConnector | null = null;

export function initializeIntuneConnector(config: IntuneConfig): IntuneConnector {
  intuneConnector = new IntuneConnector(config);
  return intuneConnector;
}

export function getIntuneConnector(): IntuneConnector {
  if (!intuneConnector) {
    throw new Error('Intune connector not initialized. Call initializeIntuneConnector first.');
  }
  return intuneConnector;
}
