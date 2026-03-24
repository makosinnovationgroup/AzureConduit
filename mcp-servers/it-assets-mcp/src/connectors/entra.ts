import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { logger } from '../server';

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  accountEnabled: boolean;
  createdDateTime: string;
  lastSignInDateTime?: string;
  userType: string;
}

export interface License {
  id: string;
  skuId: string;
  skuPartNumber: string;
  appliesTo: string;
  capabilityStatus: string;
  consumedUnits: number;
  prepaidUnits: {
    enabled: number;
    suspended: number;
    warning: number;
  };
  servicePlans: Array<{
    servicePlanId: string;
    servicePlanName: string;
    provisioningStatus: string;
    appliesTo: string;
  }>;
}

export interface UserLicense {
  userId: string;
  userPrincipalName: string;
  displayName: string;
  assignedLicenses: Array<{
    skuId: string;
    disabledPlans: string[];
  }>;
}

export interface AuthMethod {
  id: string;
  methodType: string;
}

export class EntraConnector {
  private client: Client | null = null;
  private config: EntraConfig;
  private isConnected: boolean = false;

  constructor(config: EntraConfig) {
    this.config = config;
  }

  async connect(): Promise<Client> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    logger.info('Connecting to Entra ID via Graph API...');

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

      // Test connection
      await this.client.api('/organization').get();

      this.isConnected = true;
      logger.info('Successfully connected to Entra ID');

      return this.client;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Entra ID', { error });
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

  // User Management Methods

  async getUsers(filter?: string): Promise<User[]> {
    const client = await this.getClient();
    let request = client
      .api('/users')
      .select(
        'id,displayName,userPrincipalName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones,accountEnabled,createdDateTime,userType,signInActivity'
      );

    if (filter) {
      request = request.filter(filter);
    }

    const response = await request.get();
    const users = response.value || [];

    // Map signInActivity to lastSignInDateTime
    return users.map((user: any) => ({
      ...user,
      lastSignInDateTime: user.signInActivity?.lastSignInDateTime || null,
    }));
  }

  async getUser(userId: string): Promise<User | null> {
    const client = await this.getClient();
    try {
      const user = await client
        .api(`/users/${userId}`)
        .select(
          'id,displayName,userPrincipalName,mail,jobTitle,department,officeLocation,mobilePhone,businessPhones,accountEnabled,createdDateTime,userType,signInActivity'
        )
        .get();

      return {
        ...user,
        lastSignInDateTime: user.signInActivity?.lastSignInDateTime || null,
      };
    } catch (error) {
      logger.warn('User not found', { userId });
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.getUsers(`mail eq '${email}' or userPrincipalName eq '${email}'`);
    return users.length > 0 ? users[0] : null;
  }

  async getInactiveUsers(daysInactive: number): Promise<User[]> {
    const client = await this.getClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    // Fetch users with sign-in activity
    const response = await client
      .api('/users')
      .select(
        'id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,signInActivity'
      )
      .filter('accountEnabled eq true')
      .get();

    const users = response.value || [];

    return users
      .filter((user: any) => {
        if (!user.signInActivity?.lastSignInDateTime) {
          // No sign-in activity recorded - consider inactive if created before cutoff
          const created = new Date(user.createdDateTime);
          return created < cutoffDate;
        }
        const lastSignIn = new Date(user.signInActivity.lastSignInDateTime);
        return lastSignIn < cutoffDate;
      })
      .map((user: any) => ({
        ...user,
        lastSignInDateTime: user.signInActivity?.lastSignInDateTime || null,
      }));
  }

  // MFA Methods

  async getUserAuthenticationMethods(userId: string): Promise<AuthMethod[]> {
    const client = await this.getClient();
    try {
      const response = await client.api(`/users/${userId}/authentication/methods`).get();
      return response.value || [];
    } catch (error) {
      logger.warn('Failed to get auth methods for user', { userId, error });
      return [];
    }
  }

  async getUsersWithoutMFA(): Promise<User[]> {
    const users = await this.getUsers("accountEnabled eq true and userType eq 'Member'");
    const usersWithoutMFA: User[] = [];

    for (const user of users) {
      try {
        const authMethods = await this.getUserAuthenticationMethods(user.id);

        // Check if user has MFA-capable methods (not just password)
        const hasMFA = authMethods.some(
          (method) =>
            method['@odata.type'] !== '#microsoft.graph.passwordAuthenticationMethod'
        );

        if (!hasMFA) {
          usersWithoutMFA.push(user);
        }
      } catch (error) {
        logger.warn('Failed to check MFA for user', { userId: user.id, error });
      }
    }

    return usersWithoutMFA;
  }

  // License Management Methods

  async getSubscribedSkus(): Promise<License[]> {
    const client = await this.getClient();
    const response = await client.api('/subscribedSkus').get();
    return response.value || [];
  }

  async getLicenseSummary(): Promise<{
    licenses: Array<{
      skuId: string;
      skuPartNumber: string;
      totalUnits: number;
      consumedUnits: number;
      availableUnits: number;
      utilizationPercent: number;
    }>;
    totalSpend: number;
  }> {
    const skus = await this.getSubscribedSkus();

    const licenses = skus.map((sku) => {
      const total = sku.prepaidUnits.enabled || 0;
      const consumed = sku.consumedUnits || 0;
      const available = total - consumed;

      return {
        skuId: sku.skuId,
        skuPartNumber: sku.skuPartNumber,
        totalUnits: total,
        consumedUnits: consumed,
        availableUnits: available,
        utilizationPercent: total > 0 ? Math.round((consumed / total) * 100) : 0,
      };
    });

    // Note: Actual costs would need to come from Azure Cost Management or hardcoded pricing
    const totalSpend = 0; // Placeholder - needs cost API integration

    return { licenses, totalSpend };
  }

  async getUsersWithLicense(skuId: string): Promise<UserLicense[]> {
    const client = await this.getClient();
    const response = await client
      .api('/users')
      .select('id,displayName,userPrincipalName,assignedLicenses')
      .filter(`assignedLicenses/any(l:l/skuId eq ${skuId})`)
      .get();

    return (response.value || []).map((user: any) => ({
      userId: user.id,
      userPrincipalName: user.userPrincipalName,
      displayName: user.displayName,
      assignedLicenses: user.assignedLicenses || [],
    }));
  }

  async getUnusedLicenses(
    daysInactive: number = 30
  ): Promise<
    Array<{
      user: User;
      licenses: string[];
      lastSignIn: string | null;
    }>
  > {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const client = await this.getClient();
    const response = await client
      .api('/users')
      .select(
        'id,displayName,userPrincipalName,mail,accountEnabled,assignedLicenses,signInActivity'
      )
      .filter('assignedLicenses/$count ne 0')
      .get();

    const users = response.value || [];
    const skus = await this.getSubscribedSkus();
    const skuMap = new Map(skus.map((s) => [s.skuId, s.skuPartNumber]));

    const unusedLicenses = [];

    for (const user of users) {
      const lastSignIn = user.signInActivity?.lastSignInDateTime;

      if (!lastSignIn || new Date(lastSignIn) < cutoffDate) {
        const licenseNames = (user.assignedLicenses || []).map(
          (l: any) => skuMap.get(l.skuId) || l.skuId
        );

        if (licenseNames.length > 0) {
          unusedLicenses.push({
            user: {
              id: user.id,
              displayName: user.displayName,
              userPrincipalName: user.userPrincipalName,
              mail: user.mail,
              accountEnabled: user.accountEnabled,
              lastSignInDateTime: lastSignIn,
            } as User,
            licenses: licenseNames,
            lastSignIn: lastSignIn || null,
          });
        }
      }
    }

    return unusedLicenses;
  }

  async getLicenseCosts(): Promise<
    Array<{
      skuPartNumber: string;
      totalUnits: number;
      monthlyCostPerUnit: number;
      totalMonthlyCost: number;
    }>
  > {
    const skus = await this.getSubscribedSkus();

    // Approximate Microsoft 365 license costs (USD per user/month)
    // These are estimates and should be updated with actual contract pricing
    const pricingMap: Record<string, number> = {
      'ENTERPRISEPACK': 20, // Office 365 E3
      'ENTERPRISEPREMIUM': 35, // Office 365 E5
      'SPE_E3': 32, // Microsoft 365 E3
      'SPE_E5': 57, // Microsoft 365 E5
      'M365_F1': 4, // Microsoft 365 F1
      'FLOW_FREE': 0,
      'POWER_BI_STANDARD': 0,
      'AAD_PREMIUM': 6, // Azure AD P1
      'AAD_PREMIUM_P2': 9, // Azure AD P2
      'EMS': 8.75, // EMS E3
      'EMSPREMIUM': 14.80, // EMS E5
      'EXCHANGESTANDARD': 4, // Exchange Online Plan 1
      'EXCHANGEENTERPRISE': 8, // Exchange Online Plan 2
    };

    return skus.map((sku) => {
      const price = pricingMap[sku.skuPartNumber] || 0;
      const units = sku.consumedUnits || 0;

      return {
        skuPartNumber: sku.skuPartNumber,
        totalUnits: units,
        monthlyCostPerUnit: price,
        totalMonthlyCost: price * units,
      };
    });
  }

  // Device Methods (Entra ID registered devices)

  async getUserDevices(userId: string): Promise<any[]> {
    const client = await this.getClient();
    try {
      const response = await client.api(`/users/${userId}/registeredDevices`).get();
      return response.value || [];
    } catch (error) {
      logger.warn('Failed to get devices for user', { userId, error });
      return [];
    }
  }

  async getDevicesByUserEmail(email: string): Promise<any[]> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return [];
    }
    return this.getUserDevices(user.id);
  }
}

let entraConnector: EntraConnector | null = null;

export function initializeEntraConnector(config: EntraConfig): EntraConnector {
  entraConnector = new EntraConnector(config);
  return entraConnector;
}

export function getEntraConnector(): EntraConnector {
  if (!entraConnector) {
    throw new Error('Entra connector not initialized. Call initializeEntraConnector first.');
  }
  return entraConnector;
}
