import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

/**
 * Directory Connector - Azure AD/Entra ID via Microsoft Graph API
 * Provides user directory information, org structure, and group memberships
 */

export interface DirectoryConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface DirectoryUser {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  userPrincipalName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  managerId?: string;
  managerDisplayName?: string;
  managerEmail?: string;
  accountEnabled: boolean;
  createdDateTime: string;
  lastSignInDateTime?: string;
  employeeId?: string;
  employeeType?: string;
}

export interface OrgChartNode {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  directReports: OrgChartNode[];
}

export interface UserGroup {
  id: string;
  displayName: string;
  description: string | null;
  groupTypes: string[];
  membershipType: string;
}

class DirectoryConnector {
  private config: DirectoryConfig;
  private graphClient: Client | null = null;

  constructor(config: DirectoryConfig) {
    this.config = config;
  }

  private async getClient(): Promise<Client> {
    if (this.graphClient) {
      return this.graphClient;
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

  async getUser(userIdOrEmail: string): Promise<DirectoryUser | null> {
    try {
      const client = await this.getClient();

      // Determine if input is email or ID
      const identifier = userIdOrEmail.includes('@')
        ? userIdOrEmail
        : userIdOrEmail;

      const user = await client
        .api(`/users/${identifier}`)
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'userPrincipalName',
          'mail',
          'jobTitle',
          'department',
          'officeLocation',
          'mobilePhone',
          'businessPhones',
          'accountEnabled',
          'createdDateTime',
          'employeeId',
          'employeeType',
        ])
        .get();

      // Get manager info
      let manager: { id: string; displayName: string; mail: string } | null = null;
      try {
        manager = await client
          .api(`/users/${identifier}/manager`)
          .select(['id', 'displayName', 'mail'])
          .get();
      } catch {
        // User may not have a manager
      }

      // Get last sign-in info
      let signInActivity: { lastSignInDateTime?: string } | null = null;
      try {
        const signIn = await client
          .api(`/users/${identifier}`)
          .select(['signInActivity'])
          .get();
        signInActivity = signIn.signInActivity;
      } catch {
        // Sign-in activity may not be available
      }

      return {
        id: user.id,
        displayName: user.displayName,
        givenName: user.givenName || '',
        surname: user.surname || '',
        userPrincipalName: user.userPrincipalName,
        mail: user.mail || user.userPrincipalName,
        jobTitle: user.jobTitle,
        department: user.department,
        officeLocation: user.officeLocation,
        mobilePhone: user.mobilePhone,
        businessPhones: user.businessPhones || [],
        managerId: manager?.id,
        managerDisplayName: manager?.displayName,
        managerEmail: manager?.mail,
        accountEnabled: user.accountEnabled,
        createdDateTime: user.createdDateTime,
        lastSignInDateTime: signInActivity?.lastSignInDateTime,
        employeeId: user.employeeId,
        employeeType: user.employeeType,
      };
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404) {
        return null;
      }
      console.error('Failed to get directory user:', error);
      throw error;
    }
  }

  async searchUsers(query: string, limit: number = 25): Promise<DirectoryUser[]> {
    try {
      const client = await this.getClient();

      // Use $filter with startsWith for common searches
      const filterQuery = `startsWith(displayName,'${query}') or startsWith(mail,'${query}') or startsWith(userPrincipalName,'${query}')`;

      const response = await client
        .api('/users')
        .filter(filterQuery)
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'userPrincipalName',
          'mail',
          'jobTitle',
          'department',
          'officeLocation',
          'accountEnabled',
          'employeeId',
        ])
        .top(limit)
        .get();

      return (response.value || []).map((user: Record<string, unknown>) => ({
        id: user.id as string,
        displayName: user.displayName as string,
        givenName: (user.givenName || '') as string,
        surname: (user.surname || '') as string,
        userPrincipalName: user.userPrincipalName as string,
        mail: (user.mail || user.userPrincipalName) as string,
        jobTitle: user.jobTitle as string | null,
        department: user.department as string | null,
        officeLocation: user.officeLocation as string | null,
        mobilePhone: null,
        businessPhones: [],
        accountEnabled: user.accountEnabled as boolean,
        createdDateTime: '',
        employeeId: user.employeeId as string | undefined,
      }));
    } catch (error) {
      console.error('Failed to search directory users:', error);
      throw error;
    }
  }

  async getDirectReports(userIdOrEmail: string): Promise<DirectoryUser[]> {
    try {
      const client = await this.getClient();

      const response = await client
        .api(`/users/${userIdOrEmail}/directReports`)
        .select([
          'id',
          'displayName',
          'givenName',
          'surname',
          'userPrincipalName',
          'mail',
          'jobTitle',
          'department',
          'officeLocation',
          'accountEnabled',
        ])
        .get();

      return (response.value || []).map((user: Record<string, unknown>) => ({
        id: user.id as string,
        displayName: user.displayName as string,
        givenName: (user.givenName || '') as string,
        surname: (user.surname || '') as string,
        userPrincipalName: user.userPrincipalName as string,
        mail: (user.mail || user.userPrincipalName) as string,
        jobTitle: user.jobTitle as string | null,
        department: user.department as string | null,
        officeLocation: user.officeLocation as string | null,
        mobilePhone: null,
        businessPhones: [],
        accountEnabled: user.accountEnabled as boolean,
        createdDateTime: '',
      }));
    } catch (error) {
      console.error('Failed to get direct reports:', error);
      throw error;
    }
  }

  async getOrgChart(userIdOrEmail: string, depth: number = 2): Promise<OrgChartNode> {
    const user = await this.getUser(userIdOrEmail);
    if (!user) {
      throw new Error(`User not found: ${userIdOrEmail}`);
    }

    return this.buildOrgTree(user, depth);
  }

  private async buildOrgTree(user: DirectoryUser, depth: number): Promise<OrgChartNode> {
    const node: OrgChartNode = {
      id: user.id,
      displayName: user.displayName,
      email: user.mail,
      jobTitle: user.jobTitle,
      department: user.department,
      directReports: [],
    };

    if (depth > 0) {
      try {
        const reports = await this.getDirectReports(user.id);
        for (const report of reports) {
          const childNode = await this.buildOrgTree(report, depth - 1);
          node.directReports.push(childNode);
        }
      } catch (error) {
        console.error(`Failed to get direct reports for ${user.id}:`, error);
      }
    }

    return node;
  }

  async getUserGroups(userIdOrEmail: string): Promise<UserGroup[]> {
    try {
      const client = await this.getClient();

      const response = await client
        .api(`/users/${userIdOrEmail}/memberOf`)
        .select(['id', 'displayName', 'description', 'groupTypes'])
        .get();

      return (response.value || [])
        .filter((item: Record<string, unknown>) => item['@odata.type'] === '#microsoft.graph.group')
        .map((group: Record<string, unknown>) => ({
          id: group.id as string,
          displayName: group.displayName as string,
          description: group.description as string | null,
          groupTypes: (group.groupTypes || []) as string[],
          membershipType: ((group.groupTypes as string[]) || []).includes('DynamicMembership')
            ? 'dynamic'
            : 'assigned',
        }));
    } catch (error) {
      console.error('Failed to get user groups:', error);
      throw error;
    }
  }

  async getManagerChain(userIdOrEmail: string): Promise<DirectoryUser[]> {
    const chain: DirectoryUser[] = [];
    let currentUser = userIdOrEmail;

    // Limit to prevent infinite loops
    const maxDepth = 10;

    for (let i = 0; i < maxDepth; i++) {
      try {
        const client = await this.getClient();
        const manager = await client
          .api(`/users/${currentUser}/manager`)
          .select([
            'id',
            'displayName',
            'givenName',
            'surname',
            'userPrincipalName',
            'mail',
            'jobTitle',
            'department',
          ])
          .get();

        if (!manager) break;

        chain.push({
          id: manager.id,
          displayName: manager.displayName,
          givenName: manager.givenName || '',
          surname: manager.surname || '',
          userPrincipalName: manager.userPrincipalName,
          mail: manager.mail || manager.userPrincipalName,
          jobTitle: manager.jobTitle,
          department: manager.department,
          officeLocation: null,
          mobilePhone: null,
          businessPhones: [],
          accountEnabled: true,
          createdDateTime: '',
        });

        currentUser = manager.id;
      } catch {
        // No more managers in chain
        break;
      }
    }

    return chain;
  }
}

// Singleton instance
let directoryConnector: DirectoryConnector | null = null;

export function initializeDirectoryConnector(config: DirectoryConfig): DirectoryConnector {
  directoryConnector = new DirectoryConnector(config);
  return directoryConnector;
}

export function getDirectoryConnector(): DirectoryConnector {
  if (!directoryConnector) {
    // Initialize with environment variables
    const config: DirectoryConfig = {
      tenantId: process.env.AZURE_TENANT_ID || '',
      clientId: process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    };
    directoryConnector = new DirectoryConnector(config);
  }
  return directoryConnector;
}

export function resetDirectoryConnector(): void {
  directoryConnector = null;
}

export default DirectoryConnector;
