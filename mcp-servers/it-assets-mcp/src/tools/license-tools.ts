import { z } from 'zod';
import { getEntraConnector } from '../connectors/entra';
import { logger } from '../server';

// Schema definitions
export const GetLicenseSummarySchema = z.object({});

export const GetUnusedLicensesSchema = z.object({
  days_inactive: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Number of days of inactivity to consider a license unused'),
});

export const GetLicenseCostsSchema = z.object({});

// Types
export interface LicenseSummary {
  totalLicenseTypes: number;
  totalUnits: number;
  totalConsumed: number;
  totalAvailable: number;
  overallUtilizationPercent: number;
  licenses: Array<{
    skuPartNumber: string;
    displayName: string;
    totalUnits: number;
    consumedUnits: number;
    availableUnits: number;
    utilizationPercent: number;
  }>;
  lastUpdated: string;
}

export interface UnusedLicense {
  userId: string;
  displayName: string;
  userPrincipalName: string;
  email: string | null;
  licenses: string[];
  lastSignIn: string | null;
  daysInactive: number;
  accountEnabled: boolean;
  potentialMonthlySavings: number;
}

export interface LicenseCost {
  skuPartNumber: string;
  displayName: string;
  totalUnits: number;
  monthlyCostPerUnit: number;
  totalMonthlyCost: number;
  totalAnnualCost: number;
}

// License display name mapping
const licenseDisplayNames: Record<string, string> = {
  ENTERPRISEPACK: 'Office 365 E3',
  ENTERPRISEPREMIUM: 'Office 365 E5',
  SPE_E3: 'Microsoft 365 E3',
  SPE_E5: 'Microsoft 365 E5',
  M365_F1: 'Microsoft 365 F1',
  M365_F3: 'Microsoft 365 F3',
  FLOW_FREE: 'Power Automate Free',
  POWER_BI_STANDARD: 'Power BI Free',
  POWER_BI_PRO: 'Power BI Pro',
  AAD_PREMIUM: 'Azure AD Premium P1',
  AAD_PREMIUM_P2: 'Azure AD Premium P2',
  EMS: 'Enterprise Mobility + Security E3',
  EMSPREMIUM: 'Enterprise Mobility + Security E5',
  EXCHANGESTANDARD: 'Exchange Online Plan 1',
  EXCHANGEENTERPRISE: 'Exchange Online Plan 2',
  PROJECTPROFESSIONAL: 'Project Plan 3',
  PROJECTPREMIUM: 'Project Plan 5',
  VISIOCLIENT: 'Visio Plan 2',
  STREAM: 'Microsoft Stream',
  TEAMS_EXPLORATORY: 'Microsoft Teams Exploratory',
  DESKLESSPACK: 'Office 365 F3',
  O365_BUSINESS_ESSENTIALS: 'Microsoft 365 Business Basic',
  O365_BUSINESS_PREMIUM: 'Microsoft 365 Business Standard',
  SMB_BUSINESS_PREMIUM: 'Microsoft 365 Business Premium',
  DEFENDER_ENDPOINT_P1: 'Microsoft Defender for Endpoint P1',
  DEFENDER_ENDPOINT_P2: 'Microsoft Defender for Endpoint P2',
};

// License pricing (USD per user/month - estimated, update with actual contract pricing)
const licensePricing: Record<string, number> = {
  ENTERPRISEPACK: 23,
  ENTERPRISEPREMIUM: 38,
  SPE_E3: 36,
  SPE_E5: 57,
  M365_F1: 4,
  M365_F3: 10,
  FLOW_FREE: 0,
  POWER_BI_STANDARD: 0,
  POWER_BI_PRO: 10,
  AAD_PREMIUM: 6,
  AAD_PREMIUM_P2: 9,
  EMS: 10.60,
  EMSPREMIUM: 16.40,
  EXCHANGESTANDARD: 4,
  EXCHANGEENTERPRISE: 8,
  PROJECTPROFESSIONAL: 30,
  PROJECTPREMIUM: 55,
  VISIOCLIENT: 15,
  STREAM: 0,
  TEAMS_EXPLORATORY: 0,
  DESKLESSPACK: 10,
  O365_BUSINESS_ESSENTIALS: 6,
  O365_BUSINESS_PREMIUM: 12.50,
  SMB_BUSINESS_PREMIUM: 22,
  DEFENDER_ENDPOINT_P1: 3,
  DEFENDER_ENDPOINT_P2: 5.20,
};

// Tool implementations

export async function getLicenseSummary(): Promise<LicenseSummary> {
  logger.info('Getting license summary');
  const connector = getEntraConnector();
  const summaryData = await connector.getLicenseSummary();

  let totalUnits = 0;
  let totalConsumed = 0;

  const licenses = summaryData.licenses.map((license) => {
    totalUnits += license.totalUnits;
    totalConsumed += license.consumedUnits;

    return {
      skuPartNumber: license.skuPartNumber,
      displayName: licenseDisplayNames[license.skuPartNumber] || license.skuPartNumber,
      totalUnits: license.totalUnits,
      consumedUnits: license.consumedUnits,
      availableUnits: license.availableUnits,
      utilizationPercent: license.utilizationPercent,
    };
  });

  // Sort by utilization (highest first)
  licenses.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const totalAvailable = totalUnits - totalConsumed;
  const overallUtilizationPercent =
    totalUnits > 0 ? Math.round((totalConsumed / totalUnits) * 100) : 0;

  return {
    totalLicenseTypes: licenses.length,
    totalUnits,
    totalConsumed,
    totalAvailable,
    overallUtilizationPercent,
    licenses,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getUnusedLicenses(
  params: z.infer<typeof GetUnusedLicensesSchema>
): Promise<{
  unusedLicenses: UnusedLicense[];
  summary: {
    totalUsers: number;
    totalUnusedLicenses: number;
    potentialMonthlySavings: number;
    potentialAnnualSavings: number;
  };
}> {
  const { days_inactive } = params;
  logger.info('Getting unused licenses', { days_inactive });

  const connector = getEntraConnector();
  const unusedData = await connector.getUnusedLicenses(days_inactive);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days_inactive);

  let totalSavings = 0;
  let totalUnusedLicenseCount = 0;

  const unusedLicenses: UnusedLicense[] = unusedData.map((item) => {
    // Calculate days inactive
    let daysInactive = days_inactive;
    if (item.lastSignIn) {
      const lastSignInDate = new Date(item.lastSignIn);
      daysInactive = Math.floor(
        (Date.now() - lastSignInDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Calculate potential savings
    let monthlySavings = 0;
    for (const license of item.licenses) {
      const price = licensePricing[license] || 0;
      monthlySavings += price;
      totalUnusedLicenseCount++;
    }
    totalSavings += monthlySavings;

    return {
      userId: item.user.id,
      displayName: item.user.displayName,
      userPrincipalName: item.user.userPrincipalName,
      email: item.user.mail,
      licenses: item.licenses,
      lastSignIn: item.lastSignIn,
      daysInactive,
      accountEnabled: item.user.accountEnabled,
      potentialMonthlySavings: monthlySavings,
    };
  });

  // Sort by potential savings (highest first)
  unusedLicenses.sort((a, b) => b.potentialMonthlySavings - a.potentialMonthlySavings);

  logger.info('Retrieved unused licenses', {
    userCount: unusedLicenses.length,
    totalUnusedLicenses: totalUnusedLicenseCount,
    potentialMonthlySavings: totalSavings,
  });

  return {
    unusedLicenses,
    summary: {
      totalUsers: unusedLicenses.length,
      totalUnusedLicenses: totalUnusedLicenseCount,
      potentialMonthlySavings: Math.round(totalSavings * 100) / 100,
      potentialAnnualSavings: Math.round(totalSavings * 12 * 100) / 100,
    },
  };
}

export async function getLicenseCosts(): Promise<{
  licenses: LicenseCost[];
  totals: {
    totalMonthlyCost: number;
    totalAnnualCost: number;
    averageCostPerUser: number;
  };
}> {
  logger.info('Getting license costs');
  const connector = getEntraConnector();
  const costData = await connector.getLicenseCosts();

  let totalMonthlyCost = 0;
  let totalUsers = 0;

  const licenses: LicenseCost[] = costData.map((item) => {
    totalMonthlyCost += item.totalMonthlyCost;
    totalUsers += item.totalUnits;

    return {
      skuPartNumber: item.skuPartNumber,
      displayName: licenseDisplayNames[item.skuPartNumber] || item.skuPartNumber,
      totalUnits: item.totalUnits,
      monthlyCostPerUnit: item.monthlyCostPerUnit,
      totalMonthlyCost: Math.round(item.totalMonthlyCost * 100) / 100,
      totalAnnualCost: Math.round(item.totalMonthlyCost * 12 * 100) / 100,
    };
  });

  // Sort by total cost (highest first)
  licenses.sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost);

  const averageCostPerUser =
    totalUsers > 0 ? Math.round((totalMonthlyCost / totalUsers) * 100) / 100 : 0;

  logger.info('Retrieved license costs', {
    licenseCount: licenses.length,
    totalMonthlyCost,
  });

  return {
    licenses,
    totals: {
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      totalAnnualCost: Math.round(totalMonthlyCost * 12 * 100) / 100,
      averageCostPerUser,
    },
  };
}

// Tool definitions for MCP registration
export const licenseTools = [
  {
    name: 'get_license_summary',
    description:
      'Get summary of all Microsoft 365 licenses including total units, consumed, available, and utilization percentage per license type. Key metric for license optimization.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getLicenseSummary,
    schema: GetLicenseSummarySchema,
  },
  {
    name: 'get_unused_licenses',
    description:
      'Find licenses assigned to users who have not signed in for a specified period. Helps identify license waste and potential cost savings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days_inactive: {
          type: 'number',
          description:
            'Number of days of inactivity to consider a license unused (1-365, default 30)',
        },
      },
    },
    handler: getUnusedLicenses,
    schema: GetUnusedLicensesSchema,
  },
  {
    name: 'get_license_costs',
    description:
      'Get estimated license costs by type based on standard Microsoft pricing. Includes monthly and annual cost totals. Note: Actual costs may vary based on your agreement.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getLicenseCosts,
    schema: GetLicenseCostsSchema,
  },
];
