import { z } from 'zod';
import { getIntuneConnector } from '../connectors/intune';
import { logger } from '../server';

// Schema definitions
export const GetComplianceSummarySchema = z.object({});

export const GetComplianceByPolicySchema = z.object({});

export const GetComplianceTrendSchema = z.object({
  days: z.number().min(1).max(90).optional().default(30).describe('Number of days to analyze for trend'),
});

export const GetComplianceIssuesSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of issues to return'),
});

// Types
export interface ComplianceSummary {
  totalDevices: number;
  compliantDevices: number;
  nonCompliantDevices: number;
  unknownDevices: number;
  compliancePercentage: number;
  lastUpdated: string;
}

export interface PolicyCompliance {
  policyId: string;
  policyName: string;
  compliant: number;
  nonCompliant: number;
  error: number;
  unknown: number;
  total: number;
  compliancePercentage: number;
}

export interface ComplianceTrendPoint {
  date: string;
  compliant: number;
  nonCompliant: number;
  total: number;
  compliancePercentage: number;
}

export interface ComplianceIssue {
  issue: string;
  affectedDevices: number;
  severity: 'high' | 'medium' | 'low';
  deviceNames: string[];
}

// Tool implementations

export async function getComplianceSummary(): Promise<ComplianceSummary> {
  logger.info('Getting compliance summary');
  const connector = getIntuneConnector();
  const summary = await connector.getDeviceSummary();

  const compliant = summary.byComplianceState['compliant'] || 0;
  const nonCompliant = summary.byComplianceState['noncompliant'] || 0;
  const unknown =
    summary.total -
    compliant -
    nonCompliant;

  const compliancePercentage =
    summary.total > 0 ? Math.round((compliant / summary.total) * 100) : 0;

  return {
    totalDevices: summary.total,
    compliantDevices: compliant,
    nonCompliantDevices: nonCompliant,
    unknownDevices: unknown,
    compliancePercentage,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getComplianceByPolicy(): Promise<PolicyCompliance[]> {
  logger.info('Getting compliance by policy');
  const connector = getIntuneConnector();
  const policyCompliance = await connector.getComplianceByPolicy();

  const results: PolicyCompliance[] = policyCompliance.map((policy) => {
    const total = policy.compliant + policy.nonCompliant + policy.error + policy.unknown;
    const compliancePercentage =
      total > 0 ? Math.round((policy.compliant / total) * 100) : 0;

    return {
      policyId: policy.policyId,
      policyName: policy.policyName,
      compliant: policy.compliant,
      nonCompliant: policy.nonCompliant,
      error: policy.error,
      unknown: policy.unknown,
      total,
      compliancePercentage,
    };
  });

  // Sort by compliance percentage (lowest first to highlight problem policies)
  results.sort((a, b) => a.compliancePercentage - b.compliancePercentage);

  logger.info('Retrieved compliance by policy', { policyCount: results.length });
  return results;
}

export async function getComplianceTrend(
  params: z.infer<typeof GetComplianceTrendSchema>
): Promise<ComplianceTrendPoint[]> {
  const { days } = params;
  logger.info('Getting compliance trend', { days });

  // Note: Microsoft Graph API doesn't provide historical compliance data directly.
  // In a production implementation, you would:
  // 1. Store compliance snapshots in a database regularly
  // 2. Use Azure Monitor logs or custom logging
  // 3. Query historical data from your data store

  // For this implementation, we'll return current snapshot as a starting point
  // and note that historical tracking requires additional infrastructure

  const connector = getIntuneConnector();
  const summary = await connector.getDeviceSummary();

  const compliant = summary.byComplianceState['compliant'] || 0;
  const nonCompliant = summary.byComplianceState['noncompliant'] || 0;
  const total = summary.total;
  const compliancePercentage = total > 0 ? Math.round((compliant / total) * 100) : 0;

  // Return current state as single data point
  // In production, this would return historical data
  const currentPoint: ComplianceTrendPoint = {
    date: new Date().toISOString().split('T')[0],
    compliant,
    nonCompliant,
    total,
    compliancePercentage,
  };

  // Generate simulated historical data for demonstration
  // In production, replace with actual historical queries
  const results: ComplianceTrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // For the current day, use actual data
    if (i === 0) {
      results.push(currentPoint);
    } else {
      // Placeholder - in production, query historical data
      results.push({
        date: date.toISOString().split('T')[0],
        compliant: -1, // Indicates no historical data
        nonCompliant: -1,
        total: -1,
        compliancePercentage: -1,
      });
    }
  }

  logger.info('Retrieved compliance trend', { days, dataPoints: results.length });

  return results.filter(p => p.compliancePercentage >= 0); // Only return actual data
}

export async function getComplianceIssues(
  params: z.infer<typeof GetComplianceIssuesSchema>
): Promise<ComplianceIssue[]> {
  const { limit } = params;
  logger.info('Getting top compliance issues', { limit });

  const connector = getIntuneConnector();
  const nonCompliantDevices = await connector.getNonCompliantDevices();

  // Aggregate issues by type
  const issueMap = new Map<
    string,
    { count: number; deviceNames: string[]; severity: 'high' | 'medium' | 'low' }
  >();

  // Define issue categories and their severity
  const severityMap: Record<string, 'high' | 'medium' | 'low'> = {
    encryption: 'high',
    jailbroken: 'high',
    rooted: 'high',
    password: 'high',
    firewall: 'high',
    antivirus: 'high',
    osversion: 'medium',
    systemintegrity: 'medium',
    devicethreat: 'high',
    default: 'medium',
  };

  for (const device of nonCompliantDevices) {
    // Categorize the compliance issues
    const issues: string[] = [];

    if (!device.isEncrypted) {
      issues.push('Device not encrypted');
    }

    if (device.jailBroken === 'True') {
      issues.push('Device is jailbroken/rooted');
    }

    if (device.complianceState === 'noncompliant') {
      // Try to get more specific compliance policy information
      try {
        const policyStates = await connector.getDeviceCompliancePolicyStates(device.id);

        for (const policyState of policyStates) {
          if (policyState.state !== 'compliant') {
            for (const setting of policyState.settingStates || []) {
              if (setting.state !== 'compliant') {
                issues.push(setting.settingName || 'Unknown compliance setting');
              }
            }
          }
        }
      } catch (error) {
        // If we can't get details, add generic issue
        if (issues.length === 0) {
          issues.push('Non-compliant (unspecified policy violation)');
        }
      }
    }

    // If no specific issues found, add generic
    if (issues.length === 0) {
      issues.push('Non-compliant (reason unknown)');
    }

    // Aggregate issues
    for (const issue of issues) {
      const existing = issueMap.get(issue);

      // Determine severity
      let severity: 'high' | 'medium' | 'low' = 'medium';
      for (const [keyword, sev] of Object.entries(severityMap)) {
        if (issue.toLowerCase().includes(keyword)) {
          severity = sev;
          break;
        }
      }

      if (existing) {
        existing.count++;
        if (existing.deviceNames.length < 10) {
          existing.deviceNames.push(device.deviceName);
        }
      } else {
        issueMap.set(issue, {
          count: 1,
          deviceNames: [device.deviceName],
          severity,
        });
      }
    }
  }

  // Convert to array and sort by count
  const results: ComplianceIssue[] = Array.from(issueMap.entries())
    .map(([issue, data]) => ({
      issue,
      affectedDevices: data.count,
      severity: data.severity,
      deviceNames: data.deviceNames,
    }))
    .sort((a, b) => {
      // Sort by severity first, then by affected devices
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.affectedDevices - a.affectedDevices;
    })
    .slice(0, limit);

  logger.info('Retrieved compliance issues', { issueCount: results.length });
  return results;
}

// Tool definitions for MCP registration
export const complianceTools = [
  {
    name: 'get_compliance_summary',
    description:
      'Get overall device compliance summary including total devices, compliant/non-compliant counts, and compliance percentage. Key KPI for IT security dashboards.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getComplianceSummary,
    schema: GetComplianceSummarySchema,
  },
  {
    name: 'get_compliance_by_policy',
    description:
      'Get compliance breakdown by each compliance policy. Shows which policies have the most violations and helps prioritize remediation efforts.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getComplianceByPolicy,
    schema: GetComplianceByPolicySchema,
  },
  {
    name: 'get_compliance_trend',
    description:
      'Get compliance trend over time. Note: Historical data requires additional infrastructure. Returns current snapshot and indicates where historical data would be available.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze for trend (1-90, default 30)',
        },
      },
    },
    handler: getComplianceTrend,
    schema: GetComplianceTrendSchema,
  },
  {
    name: 'get_compliance_issues',
    description:
      'Get top compliance issues across all devices, ranked by severity and number of affected devices. Helps IT identify the most critical issues to address.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of issues to return (1-100, default 20)',
        },
      },
    },
    handler: getComplianceIssues,
    schema: GetComplianceIssuesSchema,
  },
];
