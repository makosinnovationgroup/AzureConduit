import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RestClient } from "../connectors/rest-client";
import { endpointsConfig, EndpointDefinition, HttpMethod } from "../config/endpoints";
import { logger } from "../index";

/**
 * Format response data for MCP tool output
 */
function formatResponse(data: unknown, status: number, statusText: string): string {
  return JSON.stringify(
    {
      status,
      statusText,
      data,
    },
    null,
    2
  );
}

/**
 * Format error response for MCP tool output
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    const axiosError = error as { response?: { status: number; statusText: string; data: unknown } };
    if (axiosError.response) {
      return JSON.stringify(
        {
          error: true,
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data,
        },
        null,
        2
      );
    }
    return JSON.stringify({ error: true, message: error.message }, null, 2);
  }
  return JSON.stringify({ error: true, message: String(error) }, null, 2);
}

/**
 * Replace path parameters in URL
 */
function replacePathParams(path: string, params: Record<string, string>): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, encodeURIComponent(value));
  }
  return result;
}

/**
 * Register API tools with the MCP server
 */
export function registerApiTools(server: McpServer, restClient: RestClient): void {
  // Tool 1: list_endpoints - List all configured endpoints
  server.tool(
    "list_endpoints",
    "List all configured API endpoints from the configuration file",
    {},
    async () => {
      try {
        const endpoints = endpointsConfig.getEndpoints();
        const endpointList = endpoints.map((ep: EndpointDefinition) => ({
          name: ep.name,
          description: ep.description,
          method: ep.method,
          path: ep.path,
          parameters: ep.parameters.map((p) => ({
            name: p.name,
            location: p.location,
            required: p.required,
            type: p.type,
            description: p.description,
          })),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: endpointList.length,
                  endpoints: endpointList,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error("Error listing endpoints:", error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: call_endpoint - Call a named endpoint from configuration
  server.tool(
    "call_endpoint",
    "Call a configured API endpoint by name with optional parameters",
    {
      endpoint_name: z.string().describe("The name of the endpoint to call (from configuration)"),
      path_params: z
        .record(z.string())
        .optional()
        .describe("Path parameters to substitute in the URL (e.g., {id})"),
      query_params: z.record(z.unknown()).optional().describe("Query parameters to include in the request"),
      body: z.unknown().optional().describe("Request body (for POST, PUT, PATCH requests)"),
    },
    async ({ endpoint_name, path_params, query_params, body }) => {
      try {
        const endpoint = endpointsConfig.getEndpoint(endpoint_name);
        if (!endpoint) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: true,
                    message: `Endpoint '${endpoint_name}' not found in configuration`,
                    available_endpoints: endpointsConfig.getEndpoints().map((ep: EndpointDefinition) => ep.name),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Validate required parameters
        const missingParams: string[] = [];
        for (const param of endpoint.parameters) {
          if (param.required) {
            if (param.location === "path" && (!path_params || !(param.name in path_params))) {
              missingParams.push(`${param.name} (path)`);
            } else if (param.location === "query" && (!query_params || !(param.name in query_params))) {
              missingParams.push(`${param.name} (query)`);
            } else if (param.location === "body" && body === undefined) {
              missingParams.push(`${param.name} (body)`);
            }
          }
        }

        if (missingParams.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: true,
                    message: `Missing required parameters: ${missingParams.join(", ")}`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // Build the URL with path parameters
        let url = endpoint.path;
        if (path_params) {
          url = replacePathParams(url, path_params);
        }

        // Make the request
        const response = await restClient.makeRequest(endpoint.method, url, {
          params: query_params as Record<string, unknown>,
          data: body,
          headers: endpoint.headers,
        });

        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error calling endpoint ${endpoint_name}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: get_request - Make a direct GET request
  server.tool(
    "get_request",
    "Make a GET request to any path on the configured API",
    {
      path: z.string().describe("The API path to request (e.g., /users, /items/123)"),
      query_params: z.record(z.unknown()).optional().describe("Query parameters to include in the request"),
    },
    async ({ path, query_params }) => {
      try {
        const response = await restClient.get(path, query_params as Record<string, unknown>);
        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error making GET request to ${path}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: post_request - Make a direct POST request
  server.tool(
    "post_request",
    "Make a POST request to any path on the configured API",
    {
      path: z.string().describe("The API path to request (e.g., /users, /items)"),
      body: z.unknown().describe("The request body to send"),
    },
    async ({ path, body }) => {
      try {
        const response = await restClient.post(path, body);
        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error making POST request to ${path}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: put_request - Make a direct PUT request
  server.tool(
    "put_request",
    "Make a PUT request to any path on the configured API",
    {
      path: z.string().describe("The API path to request (e.g., /users/123)"),
      body: z.unknown().describe("The request body to send"),
    },
    async ({ path, body }) => {
      try {
        const response = await restClient.put(path, body);
        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error making PUT request to ${path}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: patch_request - Make a direct PATCH request
  server.tool(
    "patch_request",
    "Make a PATCH request to any path on the configured API",
    {
      path: z.string().describe("The API path to request (e.g., /users/123)"),
      body: z.unknown().describe("The request body to send"),
    },
    async ({ path, body }) => {
      try {
        const response = await restClient.patch(path, body);
        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error making PATCH request to ${path}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: delete_request - Make a direct DELETE request
  server.tool(
    "delete_request",
    "Make a DELETE request to any path on the configured API",
    {
      path: z.string().describe("The API path to request (e.g., /users/123)"),
    },
    async ({ path }) => {
      try {
        const response = await restClient.delete(path);
        return {
          content: [
            {
              type: "text",
              text: formatResponse(response.data, response.status, response.statusText),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error making DELETE request to ${path}:`, error);
        return {
          content: [{ type: "text", text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  logger.info("Registered API tools: list_endpoints, call_endpoint, get_request, post_request, put_request, patch_request, delete_request");
}
