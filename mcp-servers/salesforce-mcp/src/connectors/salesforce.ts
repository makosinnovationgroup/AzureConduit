import jsforce, { Connection, OAuth2 } from 'jsforce';
import { logger } from '../server';

export interface SalesforceConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export class SalesforceConnector {
  private connection: Connection | null = null;
  private oauth2: OAuth2;
  private config: SalesforceConfig;
  private isConnected: boolean = false;

  constructor(config: SalesforceConfig) {
    this.config = config;
    this.oauth2 = new jsforce.OAuth2({
      loginUrl: config.loginUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  async connect(): Promise<Connection> {
    if (this.connection && this.isConnected) {
      return this.connection;
    }

    logger.info('Connecting to Salesforce...');

    this.connection = new jsforce.Connection({
      oauth2: this.oauth2,
      loginUrl: this.config.loginUrl,
    });

    try {
      await this.connection.login(
        this.config.username,
        this.config.password
      );

      this.isConnected = true;
      logger.info('Successfully connected to Salesforce', {
        instanceUrl: this.connection.instanceUrl,
        userId: this.connection.userInfo?.id,
      });

      return this.connection;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Salesforce', { error });
      throw error;
    }
  }

  async getConnection(): Promise<Connection> {
    if (!this.connection || !this.isConnected) {
      return this.connect();
    }
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.logout();
        logger.info('Disconnected from Salesforce');
      } catch (error) {
        logger.error('Error disconnecting from Salesforce', { error });
      } finally {
        this.isConnected = false;
        this.connection = null;
      }
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  async query<T>(soql: string): Promise<T[]> {
    const conn = await this.getConnection();
    const result = await conn.query<T>(soql);
    return result.records;
  }

  async queryOne<T>(soql: string): Promise<T | null> {
    const records = await this.query<T>(soql);
    return records.length > 0 ? records[0] : null;
  }

  async sobject(objectName: string) {
    const conn = await this.getConnection();
    return conn.sobject(objectName);
  }
}

let salesforceConnector: SalesforceConnector | null = null;

export function initializeSalesforceConnector(config: SalesforceConfig): SalesforceConnector {
  salesforceConnector = new SalesforceConnector(config);
  return salesforceConnector;
}

export function getSalesforceConnector(): SalesforceConnector {
  if (!salesforceConnector) {
    throw new Error('Salesforce connector not initialized. Call initializeSalesforceConnector first.');
  }
  return salesforceConnector;
}
