/**
 * Health Tools
 *
 * MCP tools for retrieving and analyzing account health scores.
 * These tools aggregate data from CRM, Finance, and Support systems
 * to provide comprehensive health insights.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCRMConnector } from "../connectors/crm";
import { getFinanceConnector } from "../connectors/finance";
import { getSupportConnector } from "../connectors/support";
import {
  HealthCalculator,
  HealthInputData,
  HealthScore,
  createHealthCalculator,
} from "../services/health-calculator";

let healthCalculator: HealthCalculator | null = null;

function getHealthCalculator(): HealthCalculator {
  if (!healthCalculator) {
    healthCalculator = createHealthCalculator();
  }
  return healthCalculator;
}

/**
 * Gather health input data from all connected systems
 */
async function gatherHealthData(accountId: string): Promise<HealthInputData> {
  const data: HealthInputData = {};

  // Get CRM data
  try {
    const crm = getCRMConnector();
    if (crm.isConnected()) {
      data.account = (await crm.getAccount(accountId)) || undefined;
      data.activities = await crm.getAccountActivities(accountId, 90);
      data.opportunities = await crm.getAccountOpportunities(accountId);
      data.lastActivity = await crm.getLastActivity(accountId);
    }
  } catch (error) {
    console.warn(`[HealthTools] CRM data retrieval failed: ${error}`);
  }

  // Get Finance data
  try {
    const finance = getFinanceConnector();
    if (finance.isConnected()) {
      data.balance = await finance.getCustomerBalance(accountId);
      data.revenueTrend = await finance.getRevenueTrend(accountId, 12);
    }
  } catch (error) {
    console.warn(`[HealthTools] Finance data retrieval failed: ${error}`);
  }

  // Get Support data
  try {
    const support = getSupportConnector();
    if (support.isConnected()) {
      data.supportMetrics = await support.getOrganizationMetrics(accountId, 90);
      data.openTickets = await support.getOpenTickets(accountId);
      data.recentTickets = await support.getRecentTickets(accountId, 20);
    }
  } catch (error) {
    console.warn(`[HealthTools] Support data retrieval failed: ${error}`);
  }

  return data;
}

/**
 * Register health-related tools with the MCP server
 */
export function registerHealthTools(server: McpServer): void {
  // ==========================================================================
  // get_account_health
  // ==========================================================================
  server.tool(
    "get_account_health",
    "Get comprehensive health score for an account, including revenue trend, support ticket count, payment status, and engagement score",
    {
      account_id: z.string().describe("The unique identifier of the account"),
    },
    async ({ account_id }) => {
      console.log(`[HealthTools] Getting health for account: ${account_id}`);

      try {
        const data = await gatherHealthData(account_id);
        const calculator = getHealthCalculator();

        const accountName = data.account?.name || `Account ${account_id}`;
        const healthScore = calculator.calculateHealthScore(
          account_id,
          accountName,
          data
        );

        // Build detailed response
        const response = {
          health_score: healthScore,
          summary: {
            overall_health: healthScore.overallScore,
            risk_level: healthScore.riskLevel,
            trend: healthScore.trend,
          },
          component_scores: healthScore.scores,
          details: {
            revenue: {
              trend_data_points: data.revenueTrend?.length || 0,
              recent_revenue:
                data.revenueTrend?.slice(-3).reduce((s, r) => s + r.totalRevenue, 0) || 0,
              open_opportunities: data.opportunities?.filter((o) => !o.isClosed).length || 0,
              pipeline_value:
                data.opportunities
                  ?.filter((o) => !o.isClosed)
                  .reduce((s, o) => s + o.amount, 0) || 0,
            },
            payment: {
              total_balance: data.balance?.totalBalance || 0,
              overdue_balance: data.balance?.overdueBalance || 0,
              days_overdue: data.balance?.daysOverdue || 0,
              last_payment_date: data.balance?.lastPaymentDate || null,
            },
            support: {
              open_tickets: data.supportMetrics?.openTickets || 0,
              total_tickets_90d: data.supportMetrics?.totalTickets || 0,
              avg_resolution_hours:
                data.supportMetrics?.averageResolutionTimeHours || 0,
              satisfaction_score:
                data.supportMetrics?.averageSatisfactionScore || null,
              priority_breakdown: data.supportMetrics?.ticketsByPriority || {
                low: 0,
                normal: 0,
                high: 0,
                urgent: 0,
              },
            },
            engagement: {
              last_activity_date: data.lastActivity?.activityDate || null,
              last_activity_type: data.lastActivity?.type || null,
              recent_activities_count: data.activities?.length || 0,
              activity_types: data.activities
                ? [...new Set(data.activities.map((a) => a.type))]
                : [],
            },
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Failed to calculate health: ${errorMessage}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================================================
  // get_top_accounts_health
  // ==========================================================================
  server.tool(
    "get_top_accounts_health",
    "Get health summary for top N accounts by revenue",
    {
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of accounts to return"),
    },
    async ({ limit }) => {
      console.log(`[HealthTools] Getting health for top ${limit} accounts`);

      try {
        const crm = getCRMConnector();
        const topAccounts = await crm.getTopAccountsByRevenue(limit);

        const healthSummaries: Array<{
          account_id: string;
          account_name: string;
          annual_revenue: number | null;
          health: HealthScore | null;
          error?: string;
        }> = [];

        for (const account of topAccounts) {
          try {
            const data = await gatherHealthData(account.id);
            const calculator = getHealthCalculator();
            const healthScore = calculator.calculateHealthScore(
              account.id,
              account.name,
              data
            );

            healthSummaries.push({
              account_id: account.id,
              account_name: account.name,
              annual_revenue: account.annualRevenue || null,
              health: healthScore,
            });
          } catch (error) {
            healthSummaries.push({
              account_id: account.id,
              account_name: account.name,
              annual_revenue: account.annualRevenue || null,
              health: null,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Sort by health score (lowest first to highlight risks)
        healthSummaries.sort((a, b) => {
          const scoreA = a.health?.overallScore ?? 100;
          const scoreB = b.health?.overallScore ?? 100;
          return scoreA - scoreB;
        });

        const response = {
          total_accounts: healthSummaries.length,
          summary: {
            healthy: healthSummaries.filter(
              (h) => h.health && h.health.riskLevel === "low"
            ).length,
            medium_risk: healthSummaries.filter(
              (h) => h.health && h.health.riskLevel === "medium"
            ).length,
            high_risk: healthSummaries.filter(
              (h) => h.health && h.health.riskLevel === "high"
            ).length,
            critical: healthSummaries.filter(
              (h) => h.health && h.health.riskLevel === "critical"
            ).length,
          },
          accounts: healthSummaries.map((h) => ({
            account_id: h.account_id,
            account_name: h.account_name,
            annual_revenue: h.annual_revenue,
            overall_score: h.health?.overallScore ?? null,
            risk_level: h.health?.riskLevel ?? "unknown",
            trend: h.health?.trend ?? "unknown",
            scores: h.health?.scores ?? null,
            error: h.error,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Failed to get top accounts health: ${errorMessage}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================================================
  // get_at_risk_accounts
  // ==========================================================================
  server.tool(
    "get_at_risk_accounts",
    "Get accounts with declining health scores or high-risk indicators",
    {},
    async () => {
      console.log("[HealthTools] Getting at-risk accounts");

      try {
        const crm = getCRMConnector();
        const calculator = getHealthCalculator();

        // Get top accounts to analyze
        const accounts = await crm.getAccounts(100);
        const atRiskAccounts: Array<{
          account_id: string;
          account_name: string;
          health: HealthScore;
          risk_factors: string[];
        }> = [];

        for (const account of accounts) {
          try {
            const data = await gatherHealthData(account.id);
            const healthScore = calculator.calculateHealthScore(
              account.id,
              account.name,
              data
            );

            if (calculator.isAtRisk(healthScore)) {
              const riskFactors: string[] = [];

              // Identify specific risk factors
              if (healthScore.scores.revenue < 60) {
                riskFactors.push("Low revenue score");
              }
              if (healthScore.scores.payment < 60) {
                riskFactors.push("Payment issues");
              }
              if (healthScore.scores.support < 60) {
                riskFactors.push("High support volume");
              }
              if (healthScore.scores.engagement < 60) {
                riskFactors.push("Low engagement");
              }
              if (healthScore.trend === "declining") {
                riskFactors.push("Declining trend");
              }
              if (data.balance && data.balance.daysOverdue > 30) {
                riskFactors.push(
                  `${data.balance.daysOverdue} days overdue`
                );
              }
              if (data.supportMetrics && data.supportMetrics.openTickets > 5) {
                riskFactors.push(
                  `${data.supportMetrics.openTickets} open tickets`
                );
              }

              atRiskAccounts.push({
                account_id: account.id,
                account_name: account.name,
                health: healthScore,
                risk_factors: riskFactors,
              });
            }
          } catch (error) {
            console.warn(
              `[HealthTools] Failed to analyze account ${account.id}: ${error}`
            );
          }
        }

        // Sort by risk level and score
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        atRiskAccounts.sort((a, b) => {
          const levelDiff =
            riskOrder[a.health.riskLevel] - riskOrder[b.health.riskLevel];
          if (levelDiff !== 0) return levelDiff;
          return a.health.overallScore - b.health.overallScore;
        });

        const response = {
          total_at_risk: atRiskAccounts.length,
          by_risk_level: {
            critical: atRiskAccounts.filter(
              (a) => a.health.riskLevel === "critical"
            ).length,
            high: atRiskAccounts.filter((a) => a.health.riskLevel === "high")
              .length,
            medium: atRiskAccounts.filter(
              (a) => a.health.riskLevel === "medium"
            ).length,
          },
          accounts: atRiskAccounts.map((a) => ({
            account_id: a.account_id,
            account_name: a.account_name,
            overall_score: a.health.overallScore,
            risk_level: a.health.riskLevel,
            trend: a.health.trend,
            risk_factors: a.risk_factors,
            scores: a.health.scores,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Failed to get at-risk accounts: ${errorMessage}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================================================
  // get_health_factors
  // ==========================================================================
  server.tool(
    "get_health_factors",
    "Explain what factors contribute to an account's health score with recommendations",
    {
      account_id: z.string().describe("The unique identifier of the account"),
    },
    async ({ account_id }) => {
      console.log(
        `[HealthTools] Getting health factors for account: ${account_id}`
      );

      try {
        const data = await gatherHealthData(account_id);
        const calculator = getHealthCalculator();
        const config = calculator.getConfig();

        const factors = calculator.getHealthFactors(account_id, data);
        const healthScore = calculator.calculateHealthScore(
          account_id,
          data.account?.name || `Account ${account_id}`,
          data
        );

        const response = {
          account_id,
          account_name: data.account?.name || `Account ${account_id}`,
          overall_score: healthScore.overallScore,
          risk_level: healthScore.riskLevel,
          scoring_weights: {
            revenue: `${(config.weights.revenue * 100).toFixed(0)}%`,
            payment: `${(config.weights.payment * 100).toFixed(0)}%`,
            support: `${(config.weights.support * 100).toFixed(0)}%`,
            engagement: `${(config.weights.engagement * 100).toFixed(0)}%`,
          },
          factors_by_category: {
            revenue: factors.factors.filter((f) => f.category === "revenue"),
            payment: factors.factors.filter((f) => f.category === "payment"),
            support: factors.factors.filter((f) => f.category === "support"),
            engagement: factors.factors.filter(
              (f) => f.category === "engagement"
            ),
          },
          recommendations: factors.recommendations,
          thresholds: {
            at_risk_health_score: config.thresholds.atRiskHealth,
            revenue_decline_warning: `${(config.thresholds.revenueDecline * 100).toFixed(0)}%`,
            support_tickets_warning: config.thresholds.supportTicketsWarning,
            payment_overdue_warning: `${config.thresholds.paymentDaysOverdueWarning} days`,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Failed to get health factors: ${errorMessage}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
