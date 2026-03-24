import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { logger } from "../index";

/**
 * Authentication types supported by the REST client
 */
export type AuthType = "none" | "api-key" | "bearer" | "basic" | "oauth2";

/**
 * Configuration for the REST client
 */
export interface RestClientConfig {
  baseUrl: string;
  authType: AuthType;
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2TokenUrl?: string;
  oauth2Scope?: string;
  customHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * OAuth2 token response
 */
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * REST client with support for multiple authentication types
 */
export class RestClient {
  private client: AxiosInstance;
  private config: RestClientConfig;
  private oauth2Token: string | null = null;
  private oauth2TokenExpiry: Date | null = null;

  constructor(config: RestClientConfig) {
    this.config = config;
    this.client = this.createAxiosInstance();
  }

  /**
   * Create Axios instance with base configuration
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.config.customHeaders,
      },
    });

    // Add request interceptor for logging
    instance.interceptors.request.use(
      (config) => {
        logger.debug(`REST Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        logger.error("REST Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    instance.interceptors.response.use(
      (response) => {
        logger.debug(`REST Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        logger.error(`REST Response Error: ${error.response?.status} ${error.message}`);
        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * Get authentication headers based on auth type
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    switch (this.config.authType) {
      case "none":
        return {};

      case "api-key":
        if (!this.config.apiKey) {
          throw new Error("API key is required for api-key authentication");
        }
        const headerName = this.config.apiKeyHeader || "X-API-Key";
        return { [headerName]: this.config.apiKey };

      case "bearer":
        if (!this.config.bearerToken) {
          throw new Error("Bearer token is required for bearer authentication");
        }
        return { Authorization: `Bearer ${this.config.bearerToken}` };

      case "basic":
        if (!this.config.basicUsername || !this.config.basicPassword) {
          throw new Error("Username and password are required for basic authentication");
        }
        const credentials = Buffer.from(
          `${this.config.basicUsername}:${this.config.basicPassword}`
        ).toString("base64");
        return { Authorization: `Basic ${credentials}` };

      case "oauth2":
        const token = await this.getOAuth2Token();
        return { Authorization: `Bearer ${token}` };

      default:
        return {};
    }
  }

  /**
   * Get OAuth2 access token (with caching)
   */
  private async getOAuth2Token(): Promise<string> {
    // Check if we have a valid cached token
    if (this.oauth2Token && this.oauth2TokenExpiry && new Date() < this.oauth2TokenExpiry) {
      return this.oauth2Token;
    }

    if (!this.config.oauth2ClientId || !this.config.oauth2ClientSecret || !this.config.oauth2TokenUrl) {
      throw new Error("OAuth2 client ID, client secret, and token URL are required for OAuth2 authentication");
    }

    logger.info("Fetching new OAuth2 token...");

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", this.config.oauth2ClientId);
    params.append("client_secret", this.config.oauth2ClientSecret);
    if (this.config.oauth2Scope) {
      params.append("scope", this.config.oauth2Scope);
    }

    const response = await axios.post<OAuth2TokenResponse>(this.config.oauth2TokenUrl, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    this.oauth2Token = response.data.access_token;

    // Set expiry time (with 60 second buffer)
    if (response.data.expires_in) {
      this.oauth2TokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
    } else {
      // Default to 1 hour if not specified
      this.oauth2TokenExpiry = new Date(Date.now() + 3600 * 1000);
    }

    logger.info("OAuth2 token obtained successfully");
    return this.oauth2Token;
  }

  /**
   * Make a request with authentication
   */
  private async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const authHeaders = await this.getAuthHeaders();
    return this.client.request<T>({
      ...config,
      headers: {
        ...config.headers,
        ...authHeaders,
      },
    });
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "GET",
      url: path,
      params,
    });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(path: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "POST",
      url: path,
      data,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(path: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "PUT",
      url: path,
      data,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(path: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "PATCH",
      url: path,
      data,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(path: string): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "DELETE",
      url: path,
    });
  }

  /**
   * Make a generic request with any method
   */
  async makeRequest<T = unknown>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, unknown>;
      data?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: method.toUpperCase(),
      url: path,
      params: options?.params,
      data: options?.data,
      headers: options?.headers,
    });
  }

  /**
   * Get the current configuration
   */
  getConfig(): RestClientConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (creates new axios instance)
   */
  updateConfig(newConfig: Partial<RestClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = this.createAxiosInstance();
    // Clear OAuth2 token cache if auth config changed
    if (newConfig.oauth2ClientId || newConfig.oauth2ClientSecret || newConfig.oauth2TokenUrl) {
      this.oauth2Token = null;
      this.oauth2TokenExpiry = null;
    }
  }
}

/**
 * Create REST client from environment variables
 */
export function createRestClientFromEnv(): RestClient {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL environment variable is required");
  }

  const authType = (process.env.API_AUTH_TYPE || "none") as AuthType;
  const validAuthTypes: AuthType[] = ["none", "api-key", "bearer", "basic", "oauth2"];
  if (!validAuthTypes.includes(authType)) {
    throw new Error(`Invalid API_AUTH_TYPE: ${authType}. Must be one of: ${validAuthTypes.join(", ")}`);
  }

  let customHeaders: Record<string, string> | undefined;
  if (process.env.API_CUSTOM_HEADERS) {
    try {
      customHeaders = JSON.parse(process.env.API_CUSTOM_HEADERS);
    } catch {
      logger.warn("Failed to parse API_CUSTOM_HEADERS as JSON, ignoring");
    }
  }

  return new RestClient({
    baseUrl,
    authType,
    apiKey: process.env.API_KEY,
    apiKeyHeader: process.env.API_KEY_HEADER,
    bearerToken: process.env.API_TOKEN,
    basicUsername: process.env.API_BASIC_USERNAME,
    basicPassword: process.env.API_BASIC_PASSWORD,
    oauth2ClientId: process.env.OAUTH2_CLIENT_ID,
    oauth2ClientSecret: process.env.OAUTH2_CLIENT_SECRET,
    oauth2TokenUrl: process.env.OAUTH2_TOKEN_URL,
    oauth2Scope: process.env.OAUTH2_SCOPE,
    customHeaders,
    timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : undefined,
  });
}
