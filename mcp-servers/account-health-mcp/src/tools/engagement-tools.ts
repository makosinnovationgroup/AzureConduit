/**
 * Engagement Tools
 *
 * MCP tools for retrieving and analyzing account engagement and activity data.
 * These tools aggregate activity information from multiple systems to provide
 * a unified view of customer engagement.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCRMConnector, CRMActivity } from "../connectors/crm";
import { getSupportConnector, SupportTicket } from "../connectors/support";
import { getFinanceConnector } from "../connectors/finance";

interface UnifiedActivity {
  id: string;
  source: "crm" | "support" | "finance";
  type: string;
  subject: string;
  description?: string;
  date: string;
  owner?: string;
  status?: string;
  priority?: string;
}

/**
 * Register engagement-related tools with the MCP server
 */
export function registerEngagementTools(server: McpServer): void {
  // ==========================================================================
  // get_account_activity
  // ==========================================================================
  server.tool(
    "get_account_activity",
    "Get recent activity across all systems (CRM, Support, Finance) for a comprehensive engagement view",
    {
      account_id: z.string().describe("The unique identifier of the account"),
      days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Number of days of history to retrieve"),
      include_crm: z
        .boolean()
        .default(true)
        .describe("Include CRM activities (calls, emails, meetings, tasks)"),
      include_support: z
        .boolean()
        .default(true)
        .describe("Include support tickets"),
      include_finance: z
        .boolean()
        .default(true)
        .describe("Include financial activities (invoices, payments)"),
    },
    async ({ account_id, days, include_crm, include_support, include_finance }) => {
      console.log(
        `[EngagementTools] Getting activity for account: ${account_id}, days: ${days}`
      );

      try {
        const activities: UnifiedActivity[] = [];
        let accountName = `Account ${account_id}`;

        // Get CRM activities
        if (include_crm) {
          try {
            const crm = getCRMConnector();
            if (crm.isConnected()) {
              const account = await crm.getAccount(account_id);
              if (account) accountName = account.name;

              const crmActivities = await crm.getAccountActivities(
                account_id,
                days
              );
              for (const activity of crmActivities) {
                activities.push({
                  id: activity.id,
                  source: "crm",
                  type: activity.type,
                  subject: activity.subject,
                  description: activity.description,
                  date: activity.activityDate,
                  owner: activity.ownerName,
                  status: activity.status,
                });
              }
            }
          } catch (error) {
            console.warn(`[EngagementTools] CRM activities failed: ${error}`);
          }
        }

        // Get Support tickets
        if (include_support) {
          try {
            const support = getSupportConnector();
            if (support.isConnected()) {
              const tickets = await support.getOrganizationTickets(
                account_id,
                days
              );
              for (const ticket of tickets) {
                activities.push({
                  id: ticket.id,
                  source: "support",
                  type: `support_${ticket.type || "ticket"}`,
                  subject: ticket.subject,
                  description: ticket.description,
                  date: ticket.createdAt,
                  owner: ticket.assigneeName,
                  status: ticket.status,
                  priority: ticket.priority,
                });
              }
            }
          } catch (error) {
            console.warn(`[EngagementTools] Support tickets failed: ${error}`);
          }
        }

        // Get Financial activities (invoices)
        if (include_finance) {
          try {
            const finance = getFinanceConnector();
            if (finance.isConnected()) {
              const invoices = await finance.getCustomerInvoices(
                account_id,
                days
              );
              for (const invoice of invoices) {
                activities.push({
                  id: invoice.id,
                  source: "finance",
                  type: "invoice",
                  subject: `Invoice ${invoice.invoiceNumber}`,
                  description: `Amount: $${invoice.totalAmount.toLocaleString()}, Due: ${invoice.dueDate}`,
                  date: invoice.invoiceDate,
                  status: invoice.status,
                });
              }

              const payments = await finance.getCustomerPayments(
                account_id,
                days
              );
              for (const payment of payments) {
                activities.push({
                  id: payment.id,
                  source: "finance",
                  type: "payment",
                  subject: `Payment received`,
                  description: `Amount: $${payment.amount.toLocaleString()}${payment.referenceNumber ? `, Ref: ${payment.referenceNumber}` : ""}`,
                  date: payment.paymentDate,
                  status: "completed",
                });
              }
            }
          } catch (error) {
            console.warn(
              `[EngagementTools] Finance activities failed: ${error}`
            );
          }
        }

        // Sort all activities by date (newest first)
        activities.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Calculate summary statistics
        const summary = {
          total_activities: activities.length,
          by_source: {
            crm: activities.filter((a) => a.source === "crm").length,
            support: activities.filter((a) => a.source === "support").length,
            finance: activities.filter((a) => a.source === "finance").length,
          },
          by_type: {} as { [key: string]: number },
          date_range: {
            earliest:
              activities.length > 0
                ? activities[activities.length - 1].date
                : null,
            latest: activities.length > 0 ? activities[0].date : null,
          },
        };

        // Count by type
        for (const activity of activities) {
          const key = activity.type;
          summary.by_type[key] = (summary.by_type[key] || 0) + 1;
        }

        const response = {
          account_id,
          account_name: accountName,
          period_days: days,
          summary,
          activities: activities.map((a) => ({
            id: a.id,
            source: a.source,
            type: a.type,
            subject: a.subject,
            description: a.description,
            date: a.date,
            owner: a.owner,
            status: a.status,
            priority: a.priority,
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
                { error: `Failed to get account activity: ${errorMessage}` },
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
  // get_last_contact
  // ==========================================================================
  server.tool(
    "get_last_contact",
    "Get information about when an account was last contacted and by whom",
    {
      account_id: z.string().describe("The unique identifier of the account"),
    },
    async ({ account_id }) => {
      console.log(
        `[EngagementTools] Getting last contact for account: ${account_id}`
      );

      try {
        let accountName = `Account ${account_id}`;
        let lastCRMActivity: CRMActivity | null = null;
        let lastSupportTicket: SupportTicket | null = null;
        let lastPaymentDate: string | null = null;

        // Get last CRM activity
        try {
          const crm = getCRMConnector();
          if (crm.isConnected()) {
            const account = await crm.getAccount(account_id);
            if (account) accountName = account.name;

            lastCRMActivity = await crm.getLastActivity(account_id);
          }
        } catch (error) {
          console.warn(`[EngagementTools] CRM last activity failed: ${error}`);
        }

        // Get last support ticket
        try {
          const support = getSupportConnector();
          if (support.isConnected()) {
            const recentTickets = await support.getRecentTickets(account_id, 1);
            if (recentTickets.length > 0) {
              lastSupportTicket = recentTickets[0];
            }
          }
        } catch (error) {
          console.warn(`[EngagementTools] Support last ticket failed: ${error}`);
        }

        // Get last payment
        try {
          const finance = getFinanceConnector();
          if (finance.isConnected()) {
            const lastPayment = await finance.getLastPayment(account_id);
            if (lastPayment) {
              lastPaymentDate = lastPayment.paymentDate;
            }
          }
        } catch (error) {
          console.warn(`[EngagementTools] Finance last payment failed: ${error}`);
        }

        // Determine the most recent contact
        const contacts: Array<{
          source: string;
          type: string;
          date: string;
          details: any;
        }> = [];

        if (lastCRMActivity) {
          contacts.push({
            source: "crm",
            type: lastCRMActivity.type,
            date: lastCRMActivity.activityDate,
            details: {
              subject: lastCRMActivity.subject,
              owner: lastCRMActivity.ownerName,
              owner_email: lastCRMActivity.ownerEmail,
              status: lastCRMActivity.status,
            },
          });
        }

        if (lastSupportTicket) {
          contacts.push({
            source: "support",
            type: "support_ticket",
            date: lastSupportTicket.updatedAt || lastSupportTicket.createdAt,
            details: {
              subject: lastSupportTicket.subject,
              status: lastSupportTicket.status,
              priority: lastSupportTicket.priority,
              assignee: lastSupportTicket.assigneeName,
              requester: lastSupportTicket.requesterName,
            },
          });
        }

        if (lastPaymentDate) {
          contacts.push({
            source: "finance",
            type: "payment",
            date: lastPaymentDate,
            details: {
              description: "Payment received",
            },
          });
        }

        // Sort by date to find most recent
        contacts.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const mostRecent = contacts.length > 0 ? contacts[0] : null;

        // Calculate days since last contact
        let daysSinceContact: number | null = null;
        if (mostRecent) {
          const contactDate = new Date(mostRecent.date);
          const now = new Date();
          daysSinceContact = Math.floor(
            (now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Determine engagement status
        let engagementStatus: "active" | "recent" | "stale" | "at_risk" | "unknown";
        if (daysSinceContact === null) {
          engagementStatus = "unknown";
        } else if (daysSinceContact <= 7) {
          engagementStatus = "active";
        } else if (daysSinceContact <= 30) {
          engagementStatus = "recent";
        } else if (daysSinceContact <= 60) {
          engagementStatus = "stale";
        } else {
          engagementStatus = "at_risk";
        }

        const response = {
          account_id,
          account_name: accountName,
          engagement_status: engagementStatus,
          days_since_last_contact: daysSinceContact,
          most_recent_contact: mostRecent
            ? {
                source: mostRecent.source,
                type: mostRecent.type,
                date: mostRecent.date,
                ...mostRecent.details,
              }
            : null,
          last_contacts_by_channel: {
            crm: lastCRMActivity
              ? {
                  date: lastCRMActivity.activityDate,
                  type: lastCRMActivity.type,
                  subject: lastCRMActivity.subject,
                  owner: lastCRMActivity.ownerName,
                }
              : null,
            support: lastSupportTicket
              ? {
                  date: lastSupportTicket.updatedAt || lastSupportTicket.createdAt,
                  subject: lastSupportTicket.subject,
                  status: lastSupportTicket.status,
                  assignee: lastSupportTicket.assigneeName,
                }
              : null,
            finance: lastPaymentDate
              ? {
                  date: lastPaymentDate,
                  type: "payment",
                }
              : null,
          },
          recommendation: getEngagementRecommendation(
            engagementStatus,
            daysSinceContact
          ),
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
                { error: `Failed to get last contact: ${errorMessage}` },
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
 * Get engagement recommendation based on status
 */
function getEngagementRecommendation(
  status: string,
  daysSinceContact: number | null
): string {
  switch (status) {
    case "active":
      return "Account is actively engaged. Maintain current communication cadence.";
    case "recent":
      return "Account was contacted recently. Consider scheduling a follow-up within the next week.";
    case "stale":
      return `No contact in ${daysSinceContact} days. Schedule a check-in call to maintain the relationship.`;
    case "at_risk":
      return `Account has not been contacted in ${daysSinceContact} days. Immediate outreach recommended to re-engage.`;
    case "unknown":
      return "No engagement history found. Initiate contact to establish a relationship.";
    default:
      return "Review account engagement and determine appropriate next steps.";
  }
}
