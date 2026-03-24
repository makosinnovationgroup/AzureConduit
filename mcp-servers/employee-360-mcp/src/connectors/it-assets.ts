import axios, { AxiosInstance } from 'axios';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

/**
 * IT Asset Connector
 * Supports Microsoft Intune (via Graph API) and ServiceNow CMDB
 */

export type ITAssetSystemType = 'intune' | 'servicenow' | 'generic';

export interface ITAssetConfig {
  type: ITAssetSystemType;
  // Intune (Graph API) config
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  // ServiceNow config
  baseUrl?: string;
  username?: string;
  password?: string;
}

export interface Device {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'virtual' | 'other';
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  operatingSystem: string;
  osVersion?: string;
  enrolledDateTime?: string;
  lastSyncDateTime?: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  complianceState: 'compliant' | 'noncompliant' | 'unknown' | 'notApplicable';
  managementState: 'managed' | 'unmanaged' | 'retired' | 'wipe';
  ownerType: 'company' | 'personal' | 'unknown';
  azureAdRegistered?: boolean;
  encryptionStatus?: 'encrypted' | 'notEncrypted' | 'unknown';
  antivirusStatus?: 'enabled' | 'disabled' | 'unknown';
}

export interface ApplicationAccess {
  id: string;
  appName: string;
  appType: 'saas' | 'onPrem' | 'mobile' | 'desktop';
  assignedDate?: string;
  lastUsedDate?: string;
  licenseType?: string;
  accessLevel?: 'admin' | 'user' | 'viewer' | 'custom';
  status: 'active' | 'inactive' | 'pending';
}

export interface ComplianceStatus {
  deviceId: string;
  deviceName: string;
  overallStatus: 'compliant' | 'noncompliant' | 'unknown';
  complianceDetails: ComplianceDetail[];
  lastEvaluated: string;
}

export interface ComplianceDetail {
  policyName: string;
  settingName: string;
  state: 'compliant' | 'noncompliant' | 'error' | 'notApplicable';
  errorCode?: string;
  errorDescription?: string;
}

class ITAssetConnector {
  private config: ITAssetConfig;
  private graphClient: Client | null = null;
  private snowClient: AxiosInstance | null = null;

  constructor(config: ITAssetConfig) {
    this.config = config;
  }

  private async getIntuneClient(): Promise<Client> {
    if (this.graphClient) {
      return this.graphClient;
    }

    if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret) {
      throw new Error('Intune configuration requires tenantId, clientId, and clientSecret');
    }

    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider,
    });

    return this.graphClient;
  }

  private getServiceNowClient(): AxiosInstance {
    if (this.snowClient) {
      return this.snowClient;
    }

    if (!this.config.baseUrl || !this.config.username || !this.config.password) {
      throw new Error('ServiceNow configuration requires baseUrl, username, and password');
    }

    this.snowClient = axios.create({
      baseURL: this.config.baseUrl,
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    return this.snowClient;
  }

  async getEmployeeDevices(userIdOrEmail: string): Promise<Device[]> {
    switch (this.config.type) {
      case 'intune':
        return this.getIntuneDevices(userIdOrEmail);
      case 'servicenow':
        return this.getServiceNowDevices(userIdOrEmail);
      default:
        return this.getGenericDevices(userIdOrEmail);
    }
  }

  private async getIntuneDevices(userIdOrEmail: string): Promise<Device[]> {
    const client = await this.getIntuneClient();

    try {
      // First, get user ID if email provided
      let userId = userIdOrEmail;
      if (userIdOrEmail.includes('@')) {
        try {
          const user = await client.api(`/users/${userIdOrEmail}`).select(['id']).get();
          userId = user.id;
        } catch {
          // User might not exist, continue with email
        }
      }

      // Get managed devices for user
      const response = await client
        .api(`/users/${userId}/managedDevices`)
        .select([
          'id',
          'deviceName',
          'deviceType',
          'manufacturer',
          'model',
          'serialNumber',
          'operatingSystem',
          'osVersion',
          'enrolledDateTime',
          'lastSyncDateTime',
          'userId',
          'userPrincipalName',
          'userDisplayName',
          'complianceState',
          'managementState',
          'ownerType',
          'azureADRegistered',
          'isEncrypted',
        ])
        .get();

      return (response.value || []).map((device: Record<string, unknown>) => ({
        id: device.id as string,
        deviceName: device.deviceName as string,
        deviceType: this.normalizeDeviceType(device.deviceType as string),
        manufacturer: device.manufacturer as string | undefined,
        model: device.model as string | undefined,
        serialNumber: device.serialNumber as string | undefined,
        operatingSystem: device.operatingSystem as string,
        osVersion: device.osVersion as string | undefined,
        enrolledDateTime: device.enrolledDateTime as string | undefined,
        lastSyncDateTime: device.lastSyncDateTime as string | undefined,
        userId: device.userId as string | undefined,
        userEmail: device.userPrincipalName as string | undefined,
        userDisplayName: device.userDisplayName as string | undefined,
        complianceState: this.normalizeComplianceState(device.complianceState as string),
        managementState: this.normalizeManagementState(device.managementState as string),
        ownerType: this.normalizeOwnerType(device.ownerType as string),
        azureAdRegistered: device.azureADRegistered as boolean | undefined,
        encryptionStatus: device.isEncrypted ? 'encrypted' : 'notEncrypted',
      }));
    } catch (error) {
      console.error('Failed to get Intune devices:', error);
      throw error;
    }
  }

  private async getServiceNowDevices(userIdOrEmail: string): Promise<Device[]> {
    const client = this.getServiceNowClient();

    try {
      // Query CMDB for devices assigned to user
      const response = await client.get('/api/now/table/cmdb_ci_computer', {
        params: {
          sysparm_query: `assigned_to.email=${userIdOrEmail}^ORassigned_to.user_name=${userIdOrEmail}`,
          sysparm_fields: 'sys_id,name,asset_tag,serial_number,manufacturer,model_id.name,os,os_version,install_status,assigned_to.email,assigned_to.name',
        },
      });

      return (response.data.result || []).map((ci: Record<string, unknown>) => ({
        id: ci.sys_id as string,
        deviceName: ci.name as string,
        deviceType: this.inferDeviceTypeFromCI(ci),
        manufacturer: ci.manufacturer as string | undefined,
        model: ci['model_id.name'] as string | undefined,
        serialNumber: ci.serial_number as string | undefined,
        operatingSystem: (ci.os || 'Unknown') as string,
        osVersion: ci.os_version as string | undefined,
        userEmail: ci['assigned_to.email'] as string | undefined,
        userDisplayName: ci['assigned_to.name'] as string | undefined,
        complianceState: 'unknown' as const,
        managementState: this.inferManagementState(ci.install_status as string),
        ownerType: 'company' as const,
      }));
    } catch (error) {
      console.error('Failed to get ServiceNow devices:', error);
      throw error;
    }
  }

  private async getGenericDevices(userIdOrEmail: string): Promise<Device[]> {
    // Generic implementation - would connect to custom CMDB API
    console.log(`Generic device lookup for: ${userIdOrEmail}`);
    return [];
  }

  async getEmployeeAccess(userIdOrEmail: string): Promise<ApplicationAccess[]> {
    switch (this.config.type) {
      case 'intune':
        return this.getIntuneAppAccess(userIdOrEmail);
      case 'servicenow':
        return this.getServiceNowAppAccess(userIdOrEmail);
      default:
        return [];
    }
  }

  private async getIntuneAppAccess(userIdOrEmail: string): Promise<ApplicationAccess[]> {
    const client = await this.getIntuneClient();

    try {
      // Get app registrations and enterprise apps the user has access to
      const response = await client
        .api(`/users/${userIdOrEmail}/appRoleAssignments`)
        .get();

      const apps: ApplicationAccess[] = [];

      for (const assignment of response.value || []) {
        try {
          // Get app details
          const servicePrincipal = await client
            .api(`/servicePrincipals/${assignment.resourceId}`)
            .select(['id', 'displayName', 'servicePrincipalType', 'appId'])
            .get();

          apps.push({
            id: assignment.id,
            appName: servicePrincipal.displayName,
            appType: this.inferAppType(servicePrincipal),
            assignedDate: assignment.createdDateTime,
            accessLevel: 'user',
            status: 'active',
          });
        } catch {
          // Skip if unable to get app details
        }
      }

      return apps;
    } catch (error) {
      console.error('Failed to get Intune app access:', error);
      throw error;
    }
  }

  private async getServiceNowAppAccess(userIdOrEmail: string): Promise<ApplicationAccess[]> {
    const client = this.getServiceNowClient();

    try {
      // Query ServiceNow for software entitlements
      const response = await client.get('/api/now/table/cmdb_sam_sw_install', {
        params: {
          sysparm_query: `installed_on.assigned_to.email=${userIdOrEmail}`,
          sysparm_fields: 'sys_id,display_name,version,install_date,last_scan_date,status',
        },
      });

      return (response.data.result || []).map((sw: Record<string, unknown>) => ({
        id: sw.sys_id as string,
        appName: sw.display_name as string,
        appType: 'desktop' as const,
        assignedDate: sw.install_date as string | undefined,
        lastUsedDate: sw.last_scan_date as string | undefined,
        status: this.normalizeAppStatus(sw.status as string),
      }));
    } catch (error) {
      console.error('Failed to get ServiceNow app access:', error);
      throw error;
    }
  }

  async getDeviceCompliance(userIdOrEmail: string): Promise<ComplianceStatus[]> {
    if (this.config.type !== 'intune') {
      return [];
    }

    const client = await this.getIntuneClient();

    try {
      // Get devices first
      const devices = await this.getIntuneDevices(userIdOrEmail);
      const complianceStatuses: ComplianceStatus[] = [];

      for (const device of devices) {
        try {
          // Get compliance policy states for each device
          const response = await client
            .api(`/deviceManagement/managedDevices/${device.id}/deviceCompliancePolicyStates`)
            .get();

          const details: ComplianceDetail[] = [];
          let overallStatus: ComplianceStatus['overallStatus'] = 'compliant';

          for (const state of response.value || []) {
            const detail: ComplianceDetail = {
              policyName: state.displayName,
              settingName: state.settingName || 'Overall',
              state: this.normalizeComplianceState(state.state),
            };

            if (detail.state === 'noncompliant') {
              overallStatus = 'noncompliant';
            }

            details.push(detail);
          }

          complianceStatuses.push({
            deviceId: device.id,
            deviceName: device.deviceName,
            overallStatus,
            complianceDetails: details,
            lastEvaluated: device.lastSyncDateTime || new Date().toISOString(),
          });
        } catch {
          // Add status with unknown compliance
          complianceStatuses.push({
            deviceId: device.id,
            deviceName: device.deviceName,
            overallStatus: 'unknown',
            complianceDetails: [],
            lastEvaluated: device.lastSyncDateTime || new Date().toISOString(),
          });
        }
      }

      return complianceStatuses;
    } catch (error) {
      console.error('Failed to get device compliance:', error);
      throw error;
    }
  }

  // Helper methods for normalization
  private normalizeDeviceType(type: string): Device['deviceType'] {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('desktop') || lowerType.includes('workstation')) return 'desktop';
    if (lowerType.includes('laptop') || lowerType.includes('notebook')) return 'laptop';
    if (lowerType.includes('mobile') || lowerType.includes('phone') || lowerType.includes('iphone') || lowerType.includes('android')) return 'mobile';
    if (lowerType.includes('tablet') || lowerType.includes('ipad')) return 'tablet';
    if (lowerType.includes('virtual') || lowerType.includes('vm')) return 'virtual';
    return 'other';
  }

  private normalizeComplianceState(state: string): ComplianceStatus['overallStatus'] {
    const lowerState = (state || '').toLowerCase();
    if (lowerState.includes('compliant') && !lowerState.includes('non')) return 'compliant';
    if (lowerState.includes('noncompliant') || lowerState.includes('non-compliant')) return 'noncompliant';
    return 'unknown';
  }

  private normalizeManagementState(state: string): Device['managementState'] {
    const lowerState = (state || '').toLowerCase();
    if (lowerState.includes('managed') || lowerState.includes('enrolled')) return 'managed';
    if (lowerState.includes('retired') || lowerState.includes('decommission')) return 'retired';
    if (lowerState.includes('wipe')) return 'wipe';
    return 'unmanaged';
  }

  private normalizeOwnerType(type: string): Device['ownerType'] {
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('company') || lowerType.includes('corporate') || lowerType.includes('org')) return 'company';
    if (lowerType.includes('personal') || lowerType.includes('byod')) return 'personal';
    return 'unknown';
  }

  private inferDeviceTypeFromCI(ci: Record<string, unknown>): Device['deviceType'] {
    const className = ((ci.sys_class_name || '') as string).toLowerCase();
    const model = ((ci.model_id?.name || ci.model || '') as string).toLowerCase();

    if (className.includes('laptop') || model.includes('laptop')) return 'laptop';
    if (className.includes('mobile') || model.includes('phone')) return 'mobile';
    if (className.includes('tablet')) return 'tablet';
    if (className.includes('virtual') || className.includes('vm')) return 'virtual';
    return 'desktop';
  }

  private inferManagementState(installStatus: string): Device['managementState'] {
    const status = (installStatus || '').toLowerCase();
    if (status === 'installed' || status === 'active' || status === 'in use') return 'managed';
    if (status === 'retired' || status === 'disposed') return 'retired';
    return 'unmanaged';
  }

  private inferAppType(servicePrincipal: Record<string, unknown>): ApplicationAccess['appType'] {
    const type = ((servicePrincipal.servicePrincipalType || '') as string).toLowerCase();
    if (type.includes('application')) return 'saas';
    return 'saas';
  }

  private normalizeAppStatus(status: string): ApplicationAccess['status'] {
    const lowerStatus = (status || '').toLowerCase();
    if (lowerStatus.includes('active') || lowerStatus.includes('installed')) return 'active';
    if (lowerStatus.includes('pending')) return 'pending';
    return 'inactive';
  }
}

// Singleton instance
let itAssetConnector: ITAssetConnector | null = null;

export function initializeITAssetConnector(config: ITAssetConfig): ITAssetConnector {
  itAssetConnector = new ITAssetConnector(config);
  return itAssetConnector;
}

export function getITAssetConnector(): ITAssetConnector {
  if (!itAssetConnector) {
    // Initialize with environment variables
    const config: ITAssetConfig = {
      type: (process.env.IT_ASSET_SYSTEM_TYPE as ITAssetSystemType) || 'intune',
      // Intune config (shared with Azure AD)
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      // ServiceNow config
      baseUrl: process.env.SERVICENOW_URL,
      username: process.env.SERVICENOW_USERNAME,
      password: process.env.SERVICENOW_PASSWORD,
    };
    itAssetConnector = new ITAssetConnector(config);
  }
  return itAssetConnector;
}

export function resetITAssetConnector(): void {
  itAssetConnector = null;
}

export default ITAssetConnector;
