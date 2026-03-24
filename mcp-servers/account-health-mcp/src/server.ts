/**
 * Account Health MCP Server
 *
 * This server aggregates data from multiple enterprise systems (CRM, Finance, Support)
 * to provide comprehensive account health insights through the Model Context Protocol.
 *
 * Supported Data Sources:
 * - CRM: Salesforce, Dynamics 365
 * - Finance: QuickBooks Online, Dynamics 365 Finance
 * - Support: Zendesk, ServiceNow
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  initializeCRMConnector,
  createCRMConfigFromEnv,
  getCRMConnector,
} from "./connectors/crm";
import {
  initializeFinanceConnector,
  createFinanceConfigFromEnv,
  getFinanceConnector,
} from "./connectors/finance";
import {
  initializeSupportConnector,
  createSupportConfigFromEnv,
  getSupportConnector,
} from "./connectors/support";
import { registerHealthTools } from "./tools/health-tools";
import { registerRevenueTools } from "./tools/revenue-tools";
import { registerEngagementTools } from "./tools/engagement-tools";

// Track connector initialization status
interface ConnectorStatus {
  crm: { initialized: boolean; connected: boolean; provider: string; error?: string };
  finance: { initialized: boolean; connected: boolean; provider: string; error?: string };
  support: { initialized: boolean; connected: boolean; provider: string; error?: string };
}

let connectorStatus: ConnectorStatus = {
  crm: { initialized: false, connected: false, provider: "none" },
  finance: { initialized: false, connected: false, provider: "none" },
  support: { initialized: false, connected: false, provider: "none" },
};

/**
 * Initialize all connectors based on environment configuration
 */
async function initializeConnectors(): Promise<void> {
  // Initialize CRM connector
  try {
    const crmConfig = createCRMConfigFromEnv();
    connectorStatus.crm.provider = crmConfig.provider;

    if (
      (crmConfig.provider === "salesforce" && crmConfig.sfClientId) ||
      (crmConfig.provider === "dynamics365" && crmConfig.d365ClientId)
    ) {
      const crmConnector = initializeCRMConnector(crmConfig);
      connectorStatus.crm.initialized = true;

      try {
        await crmConnector.connect();
        connectorStatus.crm.connected = true;
        console.log(`[Server] CRM connector (${crmConfig.provider}) connected`);
      } catch (error) {
        connectorStatus.crm.error = String(error);
        console.warn(
          `[Server] CRM connector failed to connect: ${error}. Will retry on demand.`
        );
      }
    } else {
      console.log("[Server] CRM connector not configured (missing credentials)");
    }
  } catch (error) {
    connectorStatus.crm.error = String(error);
    console.error(`[Server] Failed to initialize CRM connector: ${error}`);
  }

  // Initialize Finance connector
  try {
    const financeConfig = createFinanceConfigFromEnv();
    connectorStatus.finance.provider = financeConfig.provider;

    if (
      (financeConfig.provider === "quickbooks" && financeConfig.qbClientId) ||
      (financeConfig.provider === "dynamics365_finance" &&
        financeConfig.d365ClientId)
    ) {
      const financeConnector = initializeFinanceConnector(financeConfig);
      connectorStatus.finance.initialized = true;

      try {
        await financeConnector.connect();
        connectorStatus.finance.connected = true;
        console.log(
          `[Server] Finance connector (${financeConfig.provider}) connected`
        );
      } catch (error) {
        connectorStatus.finance.error = String(error);
        console.warn(
          `[Server] Finance connector failed to connect: ${error}. Will retry on demand.`
        );
      }
    } else {
      console.log(
        "[Server] Finance connector not configured (missing credentials)"
      );
    }
  } catch (error) {
    connectorStatus.finance.error = String(error);
    console.error(`[Server] Failed to initialize Finance connector: ${error}`);
  }

  // Initialize Support connector
  try {
    const supportConfig = createSupportConfigFromEnv();
    connectorStatus.support.provider = supportConfig.provider;

    if (
      (supportConfig.provider === "zendesk" &&
        supportConfig.zendeskApiToken) ||
      (supportConfig.provider === "servicenow" &&
        supportConfig.servicenowClientId)
    ) {
      const supportConnector = initializeSupportConnector(supportConfig);
      connectorStatus.support.initialized = true;

      try {
        await supportConnector.connect();
        connectorStatus.support.connected = true;
        console.log(
          `[Server] Support connector (${supportConfig.provider}) connected`
        );
      } catch (error) {
        connectorStatus.support.error = String(error);
        console.warn(
          `[Server] Support connector failed to connect: ${error}. Will retry on demand.`
        );
      }
    } else {
      console.log(
        "[Server] Support connector not configured (missing credentials)"
      );
    }
  } catch (error) {
    connectorStatus.support.error = String(error);
    console.error(`[Server] Failed to initialize Support connector: ${error}`);
  }
}

/**
 * Get the current status of all connectors
 */
export function getConnectorStatus(): ConnectorStatus {
  // Update connected status from actual connectors
  try {
    connectorStatus.crm.connected = getCRMConnector().isConnected();
  } catch {
    connectorStatus.crm.connected = false;
  }

  try {
    connectorStatus.finance.connected = getFinanceConnector().isConnected();
  } catch {
    connectorStatus.finance.connected = false;
  }

  try {
    connectorStatus.support.connected = getSupportConnector().isConnected();
  } catch {
    connectorStatus.support.connected = false;
  }

  return connectorStatus;
}

/**
 * Creates and configures the MCP server with all account health tools
 */
export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer({
    name: "account-health-mcp",
    version: "1.0.0",
  });

  // Initialize all data source connectors
  await initializeConnectors();

  // Register all tool modules
  registerHealthTools(server);
  registerRevenueTools(server);
  registerEngagementTools(server);

  // Add a status tool to check connector health
  server.tool(
    "get_connector_status",
    "Get the current connection status of all data source connectors",
    {},
    async () => {
      const status = getConnectorStatus();

      const response = {
        status: "operational",
        connectors: {
          crm: {
            provider: status.crm.provider,
            initialized: status.crm.initialized,
            connected: status.crm.connected,
            error: status.crm.error,
          },
          finance: {
            provider: status.finance.provider,
            initialized: status.finance.initialized,
            connected: status.finance.connected,
            error: status.finance.error,
          },
          support: {
            provider: status.support.provider,
            initialized: status.support.initialized,
            connected: status.support.connected,
            error: status.support.error,
          },
        },
        capabilities: {
          health_scoring:
            status.crm.connected ||
            status.finance.connected ||
            status.support.connected,
          revenue_analysis: status.finance.connected,
          engagement_tracking: status.crm.connected || status.support.connected,
          support_metrics: status.support.connected,
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
    }
  );

  console.log("[Server] MCP server created and tools registered");
  console.log("[Server] Available tools:");
  console.log("  - Health: get_account_health, get_top_accounts_health, get_at_risk_accounts, get_health_factors");
  console.log("  - Revenue: get_account_revenue, get_revenue_trend");
  console.log("  - Engagement: get_account_activity, get_last_contact");
  console.log("  - System: get_connector_status");

  return server;
}
