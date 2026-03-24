import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../index";

/**
 * Schema for HTTP methods
 */
export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * Schema for parameter location
 */
export const ParameterLocationSchema = z.enum(["path", "query", "body", "header"]);
export type ParameterLocation = z.infer<typeof ParameterLocationSchema>;

/**
 * Schema for endpoint parameter definition
 */
export const EndpointParameterSchema = z.object({
  name: z.string().describe("Parameter name"),
  location: ParameterLocationSchema.describe("Where the parameter should be placed"),
  required: z.boolean().default(false).describe("Whether the parameter is required"),
  type: z.enum(["string", "number", "boolean", "object", "array"]).default("string").describe("Parameter type"),
  description: z.string().optional().describe("Description of the parameter"),
  default: z.any().optional().describe("Default value for the parameter"),
});
export type EndpointParameter = z.infer<typeof EndpointParameterSchema>;

/**
 * Schema for endpoint definition
 */
export const EndpointDefinitionSchema = z.object({
  name: z.string().describe("Unique name for the endpoint"),
  description: z.string().describe("Description of what this endpoint does"),
  method: HttpMethodSchema.describe("HTTP method"),
  path: z.string().describe("URL path (can include path parameters like {id})"),
  parameters: z.array(EndpointParameterSchema).default([]).describe("Parameters for this endpoint"),
  headers: z.record(z.string()).optional().describe("Additional headers for this endpoint"),
  responseType: z.enum(["json", "text", "binary"]).default("json").describe("Expected response type"),
});
export type EndpointDefinition = z.infer<typeof EndpointDefinitionSchema>;

/**
 * Schema for the endpoints configuration file
 */
export const EndpointsConfigSchema = z.object({
  version: z.string().default("1.0.0").describe("Configuration version"),
  endpoints: z.array(EndpointDefinitionSchema).describe("List of endpoint definitions"),
});
export type EndpointsConfig = z.infer<typeof EndpointsConfigSchema>;

/**
 * Endpoints configuration manager
 */
export class EndpointsConfigManager {
  private config: EndpointsConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.ENDPOINTS_CONFIG_PATH || "config/endpoints.json";
  }

  /**
   * Load endpoints configuration from file
   */
  loadConfig(): EndpointsConfig {
    if (this.config) {
      return this.config;
    }

    const absolutePath = path.isAbsolute(this.configPath)
      ? this.configPath
      : path.join(process.cwd(), this.configPath);

    if (!fs.existsSync(absolutePath)) {
      logger.warn(`Endpoints config file not found at ${absolutePath}, using empty config`);
      this.config = { version: "1.0.0", endpoints: [] };
      return this.config;
    }

    try {
      const fileContent = fs.readFileSync(absolutePath, "utf-8");
      const rawConfig = JSON.parse(fileContent);
      this.config = EndpointsConfigSchema.parse(rawConfig);
      logger.info(`Loaded ${this.config.endpoints.length} endpoints from ${absolutePath}`);
      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Invalid endpoints configuration:", error.errors);
        throw new Error(`Invalid endpoints configuration: ${JSON.stringify(error.errors)}`);
      }
      throw error;
    }
  }

  /**
   * Get all endpoint definitions
   */
  getEndpoints(): EndpointDefinition[] {
    return this.loadConfig().endpoints;
  }

  /**
   * Get endpoint by name
   */
  getEndpoint(name: string): EndpointDefinition | undefined {
    return this.getEndpoints().find((ep) => ep.name === name);
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(): EndpointsConfig {
    this.config = null;
    return this.loadConfig();
  }
}

// Export singleton instance
export const endpointsConfig = new EndpointsConfigManager();
