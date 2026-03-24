import { z } from 'zod';
import { getHRConnector, HREmployee } from '../connectors/hr';
import { getDirectoryConnector, DirectoryUser, OrgChartNode } from '../connectors/directory';
import { getITAssetConnector, Device, ApplicationAccess } from '../connectors/it-assets';

/**
 * Employee 360 Tools - Cross-system aggregation for complete employee views
 */

// Schema definitions
export const GetEmployee360Schema = z.object({
  employee_id: z.string().optional().describe('Employee ID from HR system'),
  email: z.string().email().optional().describe('Employee email address'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

export const SearchEmployeesSchema = z.object({
  query: z.string().min(1).describe('Search query (name, email, department, etc.)'),
  limit: z.number().min(1).max(100).optional().default(25).describe('Maximum number of results'),
});

export const GetOrgChartSchema = z.object({
  manager_email: z.string().email().describe('Email of the manager to get org chart for'),
  depth: z.number().min(1).max(5).optional().default(2).describe('Depth of org tree to retrieve'),
});

// Types
export interface Employee360 {
  // Core identity
  id: string;
  employeeNumber: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;

  // HR information
  hr: {
    jobTitle: string;
    department: string;
    division?: string;
    location?: string;
    hireDate: string;
    employmentStatus: HREmployee['employmentStatus'];
    employmentType: HREmployee['employmentType'];
    ptoBalance?: HREmployee['ptoBalance'];
  };

  // Manager and team
  manager?: {
    id: string;
    displayName: string;
    email: string;
    jobTitle?: string;
  };
  team?: {
    memberCount: number;
    departmentSize: number;
  };

  // Directory information
  directory: {
    userPrincipalName: string;
    officeLocation?: string;
    phone?: string;
    accountEnabled: boolean;
    lastSignIn?: string;
    groups: string[];
  };

  // IT assets
  devices: Device[];
  applications: ApplicationAccess[];

  // Recent activity summary
  recentActivity?: {
    lastLogin?: string;
    lastDeviceSync?: string;
    accessEvents?: number;
  };

  // Data source timestamps
  metadata: {
    retrievedAt: string;
    sources: {
      hr: boolean;
      directory: boolean;
      itAssets: boolean;
    };
  };
}

export interface SearchResult {
  id: string;
  displayName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  source: 'hr' | 'directory' | 'both';
}

// Tool implementations
export async function getEmployee360(
  params: z.infer<typeof GetEmployee360Schema>
): Promise<Employee360 | null> {
  const hrConnector = getHRConnector();
  const directoryConnector = getDirectoryConnector();
  const itAssetConnector = getITAssetConnector();

  const identifier = params.email || params.employee_id!;

  // Fetch data from all systems in parallel
  const [hrData, directoryData, devices, applications] = await Promise.all([
    hrConnector.getEmployee(identifier).catch((error) => {
      console.error('HR lookup failed:', error);
      return null;
    }),
    directoryConnector.getUser(identifier).catch((error) => {
      console.error('Directory lookup failed:', error);
      return null;
    }),
    itAssetConnector.getEmployeeDevices(identifier).catch((error) => {
      console.error('Device lookup failed:', error);
      return [];
    }),
    itAssetConnector.getEmployeeAccess(identifier).catch((error) => {
      console.error('App access lookup failed:', error);
      return [];
    }),
  ]);

  // If neither system found the employee, return null
  if (!hrData && !directoryData) {
    return null;
  }

  // Get user groups from directory
  let groups: string[] = [];
  if (directoryData) {
    try {
      const userGroups = await directoryConnector.getUserGroups(directoryData.id);
      groups = userGroups.map((g) => g.displayName);
    } catch {
      // Groups lookup failed
    }
  }

  // Get team info
  let teamInfo: Employee360['team'] | undefined;
  if (hrData?.managerId || hrData?.managerEmail) {
    try {
      const teamMembers = await hrConnector.getTeamMembers(
        hrData.managerId || hrData.managerEmail!
      );
      teamInfo = {
        memberCount: teamMembers.length,
        departmentSize: teamMembers.length, // Could be refined with department query
      };
    } catch {
      // Team lookup failed
    }
  }

  // Get PTO balance if available
  let ptoBalance = hrData?.ptoBalance;
  if (hrData && !ptoBalance) {
    try {
      ptoBalance = await hrConnector.getPTOBalance(hrData.id);
    } catch {
      // PTO lookup failed
    }
  }

  // Build the 360 profile
  const employee360: Employee360 = {
    // Core identity - prefer HR data
    id: hrData?.id || directoryData?.id || '',
    employeeNumber: hrData?.employeeNumber || directoryData?.employeeId || '',
    displayName: hrData?.displayName || directoryData?.displayName || '',
    firstName: hrData?.firstName || directoryData?.givenName || '',
    lastName: hrData?.lastName || directoryData?.surname || '',
    email: hrData?.email || directoryData?.mail || identifier,

    // HR information
    hr: {
      jobTitle: hrData?.jobTitle || directoryData?.jobTitle || '',
      department: hrData?.department || directoryData?.department || '',
      division: hrData?.division,
      location: hrData?.location || directoryData?.officeLocation || undefined,
      hireDate: hrData?.hireDate || '',
      employmentStatus: hrData?.employmentStatus || 'active',
      employmentType: hrData?.employmentType || 'fullTime',
      ptoBalance,
    },

    // Manager info
    manager: hrData?.managerId || directoryData?.managerId
      ? {
          id: hrData?.managerId || directoryData?.managerId || '',
          displayName:
            hrData?.managerName || directoryData?.managerDisplayName || '',
          email: hrData?.managerEmail || directoryData?.managerEmail || '',
          jobTitle: undefined, // Would need additional lookup
        }
      : undefined,

    // Team info
    team: teamInfo,

    // Directory information
    directory: {
      userPrincipalName: directoryData?.userPrincipalName || hrData?.email || '',
      officeLocation: directoryData?.officeLocation || hrData?.location || undefined,
      phone: directoryData?.mobilePhone || directoryData?.businessPhones?.[0],
      accountEnabled: directoryData?.accountEnabled ?? true,
      lastSignIn: directoryData?.lastSignInDateTime,
      groups,
    },

    // IT assets
    devices,
    applications,

    // Recent activity summary
    recentActivity: {
      lastLogin: directoryData?.lastSignInDateTime,
      lastDeviceSync: devices.length > 0
        ? devices.reduce((latest, d) => {
            if (!d.lastSyncDateTime) return latest;
            if (!latest) return d.lastSyncDateTime;
            return new Date(d.lastSyncDateTime) > new Date(latest)
              ? d.lastSyncDateTime
              : latest;
          }, '' as string)
        : undefined,
      accessEvents: undefined, // Would need activity log integration
    },

    // Metadata
    metadata: {
      retrievedAt: new Date().toISOString(),
      sources: {
        hr: !!hrData,
        directory: !!directoryData,
        itAssets: devices.length > 0 || applications.length > 0,
      },
    },
  };

  return employee360;
}

export async function searchEmployees(
  params: z.infer<typeof SearchEmployeesSchema>
): Promise<SearchResult[]> {
  const hrConnector = getHRConnector();
  const directoryConnector = getDirectoryConnector();

  // Search both systems in parallel
  const [hrResults, directoryResults] = await Promise.all([
    hrConnector.searchEmployees(params.query).catch((error) => {
      console.error('HR search failed:', error);
      return [];
    }),
    directoryConnector.searchUsers(params.query, params.limit).catch((error) => {
      console.error('Directory search failed:', error);
      return [];
    }),
  ]);

  // Combine and deduplicate results
  const resultsMap = new Map<string, SearchResult>();

  // Add HR results
  for (const emp of hrResults) {
    const key = emp.email.toLowerCase();
    resultsMap.set(key, {
      id: emp.id,
      displayName: emp.displayName,
      email: emp.email,
      jobTitle: emp.jobTitle,
      department: emp.department,
      source: 'hr',
    });
  }

  // Add/merge directory results
  for (const user of directoryResults) {
    const key = user.mail.toLowerCase();
    const existing = resultsMap.get(key);

    if (existing) {
      // Merge - mark as found in both systems
      existing.source = 'both';
      // Prefer HR data but fill gaps from directory
      if (!existing.jobTitle) existing.jobTitle = user.jobTitle || undefined;
      if (!existing.department) existing.department = user.department || undefined;
    } else {
      resultsMap.set(key, {
        id: user.id,
        displayName: user.displayName,
        email: user.mail,
        jobTitle: user.jobTitle || undefined,
        department: user.department || undefined,
        source: 'directory',
      });
    }
  }

  // Convert to array and limit results
  return Array.from(resultsMap.values()).slice(0, params.limit);
}

export async function getOrgChart(
  params: z.infer<typeof GetOrgChartSchema>
): Promise<OrgChartNode> {
  const directoryConnector = getDirectoryConnector();

  return directoryConnector.getOrgChart(params.manager_email, params.depth);
}

// Tool definitions for MCP registration
export const employeeTools = [
  {
    name: 'get_employee_360',
    description:
      'Get a complete 360-degree view of an employee aggregating HR info, directory data, assigned devices, application access, and recent activity',
    inputSchema: {
      type: 'object' as const,
      properties: {
        employee_id: {
          type: 'string',
          description: 'Employee ID from the HR system',
        },
        email: {
          type: 'string',
          description: 'Employee email address',
        },
      },
    },
    handler: getEmployee360,
    schema: GetEmployee360Schema,
  },
  {
    name: 'search_employees',
    description:
      'Search for employees across HR and directory systems by name, email, department, or other attributes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (name, email, department, etc.)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100)',
        },
      },
      required: ['query'],
    },
    handler: searchEmployees,
    schema: SearchEmployeesSchema,
  },
  {
    name: 'get_org_chart',
    description:
      'Get the organizational chart/reporting structure starting from a manager, showing direct reports recursively up to the specified depth',
    inputSchema: {
      type: 'object' as const,
      properties: {
        manager_email: {
          type: 'string',
          description: 'Email address of the manager to get org chart for',
        },
        depth: {
          type: 'number',
          description: 'Depth of org tree to retrieve (1-5, default 2)',
        },
      },
      required: ['manager_email'],
    },
    handler: getOrgChart,
    schema: GetOrgChartSchema,
  },
];
