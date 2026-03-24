import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RestClient, createRestClientFromEnv } from "./connectors/rest-client";
import { registerApiTools } from "./tools/api-tools";
import { logger } from "./index";

/**
 * Creates and configures the MCP server with REST API tools
 */
export function createMcpServer(restClient?: RestClient): McpServer {
  const server = new McpServer({
    name: "rest-api-mcp",
    version: "1.0.0",
  });

  // Create REST client from environment if not provided
  const client = restClient || createRestClientFromEnv();

  // Register API tools
  registerApiTools(server, client);

  logger.info("MCP server created and configured");
  return server;
}

/**
 * Get REST client configuration summary (without secrets)
 */
export function getConfigSummary(restClient: RestClient): Record<string, unknown> {
  const config = restClient.getConfig();
  return {
    baseUrl: config.baseUrl,
    authType: config.authType,
    hasApiKey: !!config.apiKey,
    apiKeyHeader: config.apiKeyHeader,
    hasBearerToken: !!config.bearerToken,
    hasBasicAuth: !!(config.basicUsername && config.basicPassword),
    hasOAuth2: !!(config.oauth2ClientId && config.oauth2ClientSecret && config.oauth2TokenUrl),
    customHeadersCount: config.customHeaders ? Object.keys(config.customHeaders).length : 0,
    timeout: config.timeout,
  };
}
