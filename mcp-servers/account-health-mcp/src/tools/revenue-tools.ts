/**
 * Revenue Tools
 *
 * MCP tools for retrieving and analyzing account revenue data.
 * These tools pull financial data from connected finance systems
 * to provide revenue insights and trend analysis.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFinanceConnector, RevenueData } from "../connectors/finance";
import { getCRMConnector } from "../connectors/crm";

/**
 * Register revenue-related tools with the MCP server
 */
export function registerRevenueTools(server: McpServer): void {
  // ==========================================================================
  // get_account_revenue
  // ==========================================================================
  server.tool(
    "get_account_revenue",
    "Get revenue history for an account over a specified period",
    {
      account_id: z.string().describe("The unique identifier of the account"),
      period: z
        .enum(["3m", "6m", "12m", "24m", "ytd", "all"])
        .default("12m")
        .describe(
          "Time period for revenue data: 3m (3 months), 6m (6 months), 12m (1 year), 24m (2 years), ytd (year-to-date), all (all available)"
        ),
    },
    async ({ account_id, period }) => {
      console.log(
        `[RevenueTools] Getting revenue for account: ${account_id}, period: ${period}`
      );

      try {
        const finance = getFinanceConnector();

        // Calculate date range based on period
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
          case "3m":
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case "6m":
            startDate.setMonth(startDate.getMonth() - 6);
            break;
          case "12m":
            startDate.setMonth(startDate.getMonth() - 12);
            break;
          case "24m":
            startDate.setMonth(startDate.getMonth() - 24);
            break;
          case "ytd":
            startDate.setMonth(0);
            startDate.setDate(1);
            break;
          case "all":
            startDate.setFullYear(startDate.getFullYear() - 10);
            break;
        }

        const revenueData = await finance.getCustomerRevenue(
          account_id,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        );

        // Get account name from CRM if available
        let accountName = `Account ${account_id}`;
        try {
          const crm = getCRMConnector();
          const account = await crm.getAccount(account_id);
          if (account) accountName = account.name;
        } catch {
          // CRM lookup failed, use default name
        }

        // Calculate summary statistics
        const totalRevenue = revenueData.reduce(
          (sum, r) => sum + r.totalRevenue,
          0
        );
        const totalInvoices = revenueData.reduce(
          (sum, r) => sum + r.invoiceCount,
          0
        );
        const avgMonthlyRevenue =
          revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
        const avgInvoiceAmount =
          totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

        // Find min/max months
        let maxMonth: RevenueData | null = null;
        let minMonth: RevenueData | null = null;
        for (const month of revenueData) {
          if (!maxMonth || month.totalRevenue > maxMonth.totalRevenue) {
            maxMonth = month;
          }
          if (!minMonth || month.totalRevenue < minMonth.totalRevenue) {
            minMonth = month;
          }
        }

        const response = {
          account_id,
          account_name: accountName,
          period,
          date_range: {
            start: startDate.toISOString().split("T")[0],
            end: endDate.toISOString().split("T")[0],
          },
          summary: {
            total_revenue: totalRevenue,
            total_invoices: totalInvoices,
            average_monthly_revenue: Math.round(avgMonthlyRevenue * 100) / 100,
            average_invoice_amount: Math.round(avgInvoiceAmount * 100) / 100,
            months_with_data: revenueData.length,
            highest_month: maxMonth
              ? {
                  period: maxMonth.period,
                  revenue: maxMonth.totalRevenue,
                }
              : null,
            lowest_month: minMonth
              ? {
                  period: minMonth.period,
                  revenue: minMonth.totalRevenue,
                }
              : null,
          },
          monthly_breakdown: revenueData.map((r) => ({
            period: r.period,
            revenue: r.totalRevenue,
            invoice_count: r.invoiceCount,
            average_invoice: Math.round(r.averageInvoiceAmount * 100) / 100,
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
                { error: `Failed to get account revenue: ${errorMessage}` },
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
  // get_revenue_trend
  // ==========================================================================
  server.tool(
    "get_revenue_trend",
    "Compare revenue between time periods to identify trends and growth",
    {
      account_id: z.string().describe("The unique identifier of the account"),
      comparison_periods: z
        .number()
        .min(2)
        .max(12)
        .default(6)
        .describe(
          "Number of months to compare (compares this period vs the previous period of same length)"
        ),
    },
    async ({ account_id, comparison_periods }) => {
      console.log(
        `[RevenueTools] Getting revenue trend for account: ${account_id}, periods: ${comparison_periods}`
      );

      try {
        const finance = getFinanceConnector();

        // Get revenue for double the comparison period to have both periods
        const totalPeriods = comparison_periods * 2;
        const revenueTrend = await finance.getRevenueTrend(
          account_id,
          totalPeriods
        );

        // Get account name from CRM if available
        let accountName = `Account ${account_id}`;
        try {
          const crm = getCRMConnector();
          const account = await crm.getAccount(account_id);
          if (account) accountName = account.name;
        } catch {
          // CRM lookup failed, use default name
        }

        // Split into current and previous periods
        const currentPeriod = revenueTrend.slice(-comparison_periods);
        const previousPeriod = revenueTrend.slice(
          -totalPeriods,
          -comparison_periods
        );

        // Calculate totals
        const currentTotal = currentPeriod.reduce(
          (sum, r) => sum + r.totalRevenue,
          0
        );
        const previousTotal = previousPeriod.reduce(
          (sum, r) => sum + r.totalRevenue,
          0
        );

        // Calculate growth metrics
        const absoluteChange = currentTotal - previousTotal;
        const percentageChange =
          previousTotal > 0
            ? ((currentTotal - previousTotal) / previousTotal) * 100
            : currentTotal > 0
            ? 100
            : 0;

        // Determine trend
        let trend: "strong_growth" | "growth" | "stable" | "decline" | "strong_decline";
        if (percentageChange > 20) trend = "strong_growth";
        else if (percentageChange > 5) trend = "growth";
        else if (percentageChange > -5) trend = "stable";
        else if (percentageChange > -20) trend = "decline";
        else trend = "strong_decline";

        // Calculate month-over-month changes
        const monthlyChanges: Array<{
          period: string;
          revenue: number;
          change_from_previous: number | null;
          percentage_change: number | null;
        }> = [];

        for (let i = 0; i < revenueTrend.length; i++) {
          const current = revenueTrend[i];
          const previous = i > 0 ? revenueTrend[i - 1] : null;

          monthlyChanges.push({
            period: current.period,
            revenue: current.totalRevenue,
            change_from_previous: previous
              ? current.totalRevenue - previous.totalRevenue
              : null,
            percentage_change:
              previous && previous.totalRevenue > 0
                ? Math.round(
                    ((current.totalRevenue - previous.totalRevenue) /
                      previous.totalRevenue) *
                      10000
                  ) / 100
                : null,
          });
        }

        // Calculate volatility (standard deviation as percentage of mean)
        const revenues = revenueTrend.map((r) => r.totalRevenue);
        const meanRevenue =
          revenues.reduce((a, b) => a + b, 0) / revenues.length;
        const variance =
          revenues.reduce((sum, r) => sum + Math.pow(r - meanRevenue, 2), 0) /
          revenues.length;
        const stdDev = Math.sqrt(variance);
        const volatility = meanRevenue > 0 ? (stdDev / meanRevenue) * 100 : 0;

        const response = {
          account_id,
          account_name: accountName,
          analysis_periods: comparison_periods,
          trend,
          trend_description: getTrendDescription(trend, percentageChange),
          comparison: {
            current_period: {
              months: currentPeriod.map((r) => r.period),
              total_revenue: currentTotal,
              average_monthly: Math.round((currentTotal / comparison_periods) * 100) / 100,
              invoice_count: currentPeriod.reduce(
                (sum, r) => sum + r.invoiceCount,
                0
              ),
            },
            previous_period: {
              months: previousPeriod.map((r) => r.period),
              total_revenue: previousTotal,
              average_monthly:
                Math.round((previousTotal / (previousPeriod.length || 1)) * 100) / 100,
              invoice_count: previousPeriod.reduce(
                (sum, r) => sum + r.invoiceCount,
                0
              ),
            },
            change: {
              absolute: Math.round(absoluteChange * 100) / 100,
              percentage: Math.round(percentageChange * 100) / 100,
            },
          },
          statistics: {
            mean_monthly_revenue: Math.round(meanRevenue * 100) / 100,
            volatility_percentage: Math.round(volatility * 100) / 100,
            volatility_assessment:
              volatility < 20
                ? "low"
                : volatility < 40
                ? "moderate"
                : "high",
          },
          monthly_changes: monthlyChanges,
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
                { error: `Failed to get revenue trend: ${errorMessage}` },
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

/**
 * Get human-readable trend description
 */
function getTrendDescription(
  trend: string,
  percentageChange: number
): string {
  const absChange = Math.abs(Math.round(percentageChange * 10) / 10);

  switch (trend) {
    case "strong_growth":
      return `Revenue is growing strongly at ${absChange}% compared to the previous period. This indicates a healthy, expanding relationship.`;
    case "growth":
      return `Revenue is growing at ${absChange}% compared to the previous period. The account shows positive momentum.`;
    case "stable":
      return `Revenue is relatively stable with a ${percentageChange > 0 ? "+" : ""}${absChange}% change. Consider opportunities for expansion.`;
    case "decline":
      return `Revenue has declined by ${absChange}% compared to the previous period. Review account health and engagement.`;
    case "strong_decline":
      return `Revenue has declined significantly by ${absChange}%. Immediate attention recommended to understand and address the decline.`;
    default:
      return `Revenue change: ${percentageChange > 0 ? "+" : ""}${absChange}%`;
  }
}
