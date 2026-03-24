import { z } from 'zod';
import { getEntraConnector, User } from '../connectors/entra';
import { getIntuneConnector, ManagedDevice } from '../connectors/intune';
import { logger } from '../server';

// Schema definitions
export const GetUserDevicesSchema = z.object({
  user_email: z.string().email().describe('The email address of the user'),
});

export const GetUsersWithoutMFASchema = z.object({
  include_guests: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include guest users in the results'),
});

export const GetInactiveUsersSchema = z.object({
  days_inactive: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Number of days since last sign-in to consider inactive'),
  include_disabled: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include disabled accounts in the results'),
});

// Types
export interface UserDevice {
  deviceId: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  complianceState: string;
  isEncrypted: boolean;
  managementState: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
}

export interface UserWithDevices {
  user: {
    id: string;
    displayName: string;
    userPrincipalName: string;
    email: string | null;
    department: string | null;
    jobTitle: string | null;
  };
  devices: UserDevice[];
  totalDevices: number;
}

export interface UserWithoutMFA {
  id: string;
  displayName: string;
  userPrincipalName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  accountEnabled: boolean;
  userType: string;
  createdDateTime: string;
  lastSignInDateTime: string | null;
}

export interface InactiveUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  accountEnabled: boolean;
  lastSignInDateTime: string | null;
  daysInactive: number;
  createdDateTime: string;
  assignedLicenses: number;
}

// Tool implementations

export async function getUserDevices(
  params: z.infer<typeof GetUserDevicesSchema>
): Promise<UserWithDevices | { error: string }> {
  const { user_email } = params;
  logger.info('Getting devices for user', { user_email });

  const entraConnector = getEntraConnector();
  const intuneConnector = getIntuneConnector();

  // Find the user
  const user = await entraConnector.getUserByEmail(user_email);
  if (!user) {
    return { error: `User not found: ${user_email}` };
  }

  // Get all managed devices
  const allDevices = await intuneConnector.getManagedDevices();

  // Filter devices for this user
  const userDevices = allDevices.filter(
    (device) =>
      device.userPrincipalName?.toLowerCase() === user_email.toLowerCase() ||
      device.emailAddress?.toLowerCase() === user_email.toLowerCase()
  );

  const devices: UserDevice[] = userDevices.map((device) => ({
    deviceId: device.id,
    deviceName: device.deviceName,
    operatingSystem: device.operatingSystem,
    osVersion: device.osVersion,
    enrolledDateTime: device.enrolledDateTime,
    lastSyncDateTime: device.lastSyncDateTime,
    complianceState: device.complianceState,
    isEncrypted: device.isEncrypted,
    managementState: device.managementState,
    model: device.model,
    manufacturer: device.manufacturer,
    serialNumber: device.serialNumber,
  }));

  logger.info('Retrieved user devices', { user_email, deviceCount: devices.length });

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      userPrincipalName: user.userPrincipalName,
      email: user.mail,
      department: user.department,
      jobTitle: user.jobTitle,
    },
    devices,
    totalDevices: devices.length,
  };
}

export async function getUsersWithoutMFA(
  params: z.infer<typeof GetUsersWithoutMFASchema>
): Promise<{
  users: UserWithoutMFA[];
  summary: {
    totalUsersWithoutMFA: number;
    percentageWithoutMFA: number;
    byDepartment: Record<string, number>;
  };
}> {
  const { include_guests } = params;
  logger.info('Getting users without MFA', { include_guests });

  const connector = getEntraConnector();
  const usersWithoutMFA = await connector.getUsersWithoutMFA();

  // Filter out guests if not requested
  let filteredUsers = usersWithoutMFA;
  if (!include_guests) {
    filteredUsers = usersWithoutMFA.filter((user) => user.userType === 'Member');
  }

  // Get total user count for percentage calculation
  const allUsers = await connector.getUsers("accountEnabled eq true");
  const totalEnabledUsers = include_guests
    ? allUsers.length
    : allUsers.filter((u) => u.userType === 'Member').length;

  // Count by department
  const byDepartment: Record<string, number> = {};
  for (const user of filteredUsers) {
    const dept = user.department || 'Unknown';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  }

  const users: UserWithoutMFA[] = filteredUsers.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    userPrincipalName: user.userPrincipalName,
    email: user.mail,
    department: user.department,
    jobTitle: user.jobTitle,
    accountEnabled: user.accountEnabled,
    userType: user.userType,
    createdDateTime: user.createdDateTime,
    lastSignInDateTime: user.lastSignInDateTime || null,
  }));

  const percentageWithoutMFA =
    totalEnabledUsers > 0
      ? Math.round((filteredUsers.length / totalEnabledUsers) * 100)
      : 0;

  logger.info('Retrieved users without MFA', {
    count: users.length,
    percentage: percentageWithoutMFA,
  });

  return {
    users,
    summary: {
      totalUsersWithoutMFA: users.length,
      percentageWithoutMFA,
      byDepartment,
    },
  };
}

export async function getInactiveUsers(
  params: z.infer<typeof GetInactiveUsersSchema>
): Promise<{
  users: InactiveUser[];
  summary: {
    totalInactiveUsers: number;
    usersWithLicenses: number;
    totalAssignedLicenses: number;
    byDepartment: Record<string, number>;
    byInactivityRange: Record<string, number>;
  };
}> {
  const { days_inactive, include_disabled } = params;
  logger.info('Getting inactive users', { days_inactive, include_disabled });

  const connector = getEntraConnector();
  const inactiveUsers = await connector.getInactiveUsers(days_inactive);

  // Filter by enabled status if requested
  let filteredUsers = inactiveUsers;
  if (!include_disabled) {
    filteredUsers = inactiveUsers.filter((user) => user.accountEnabled);
  }

  // Get license information for these users
  const client = await connector.getClient();
  const usersWithLicenseInfo: InactiveUser[] = [];

  // Count by department and inactivity range
  const byDepartment: Record<string, number> = {};
  const byInactivityRange: Record<string, number> = {
    '30-60 days': 0,
    '60-90 days': 0,
    '90-180 days': 0,
    '180+ days': 0,
  };

  let usersWithLicenses = 0;
  let totalAssignedLicenses = 0;

  for (const user of filteredUsers) {
    // Calculate days inactive
    let daysInactive = days_inactive;
    if (user.lastSignInDateTime) {
      const lastSignIn = new Date(user.lastSignInDateTime);
      daysInactive = Math.floor(
        (Date.now() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      // If no sign-in recorded, calculate from creation date
      const created = new Date(user.createdDateTime);
      daysInactive = Math.floor(
        (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Get license count
    let licenseCount = 0;
    try {
      const userDetail = await client
        .api(`/users/${user.id}`)
        .select('assignedLicenses')
        .get();
      licenseCount = userDetail.assignedLicenses?.length || 0;
      if (licenseCount > 0) {
        usersWithLicenses++;
        totalAssignedLicenses += licenseCount;
      }
    } catch (error) {
      logger.warn('Failed to get license info for user', { userId: user.id, error });
    }

    // Count by department
    const dept = user.department || 'Unknown';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;

    // Count by inactivity range
    if (daysInactive >= 180) {
      byInactivityRange['180+ days']++;
    } else if (daysInactive >= 90) {
      byInactivityRange['90-180 days']++;
    } else if (daysInactive >= 60) {
      byInactivityRange['60-90 days']++;
    } else {
      byInactivityRange['30-60 days']++;
    }

    usersWithLicenseInfo.push({
      id: user.id,
      displayName: user.displayName,
      userPrincipalName: user.userPrincipalName,
      email: user.mail,
      department: user.department,
      jobTitle: user.jobTitle,
      accountEnabled: user.accountEnabled,
      lastSignInDateTime: user.lastSignInDateTime || null,
      daysInactive,
      createdDateTime: user.createdDateTime,
      assignedLicenses: licenseCount,
    });
  }

  // Sort by days inactive (most inactive first)
  usersWithLicenseInfo.sort((a, b) => b.daysInactive - a.daysInactive);

  logger.info('Retrieved inactive users', {
    count: usersWithLicenseInfo.length,
    usersWithLicenses,
    totalLicenses: totalAssignedLicenses,
  });

  return {
    users: usersWithLicenseInfo,
    summary: {
      totalInactiveUsers: usersWithLicenseInfo.length,
      usersWithLicenses,
      totalAssignedLicenses,
      byDepartment,
      byInactivityRange,
    },
  };
}

// Tool definitions for MCP registration
export const userTools = [
  {
    name: 'get_user_devices',
    description:
      'Get all devices assigned to a specific user by their email address. Returns device details including compliance status, encryption, and sync information.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        user_email: {
          type: 'string',
          description: 'The email address of the user',
        },
      },
      required: ['user_email'],
    },
    handler: getUserDevices,
    schema: GetUserDevicesSchema,
  },
  {
    name: 'get_users_without_mfa',
    description:
      'Get all users who do not have MFA (multi-factor authentication) enabled. Critical security metric for Zero Trust compliance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_guests: {
          type: 'boolean',
          description: 'Include guest users in the results (default: false)',
        },
      },
    },
    handler: getUsersWithoutMFA,
    schema: GetUsersWithoutMFASchema,
  },
  {
    name: 'get_inactive_users',
    description:
      'Get users who have not signed in for a specified number of days. Helps identify dormant accounts that may have assigned licenses or pose security risks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days_inactive: {
          type: 'number',
          description:
            'Number of days since last sign-in to consider inactive (1-365, default 30)',
        },
        include_disabled: {
          type: 'boolean',
          description: 'Include disabled accounts in the results (default: false)',
        },
      },
    },
    handler: getInactiveUsers,
    schema: GetInactiveUsersSchema,
  },
];
