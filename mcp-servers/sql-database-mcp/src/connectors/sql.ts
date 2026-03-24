import * as mssql from 'mssql';
import { Pool as PgPool } from 'pg';
import * as mysql from 'mysql2/promise';
import logger from '../utils/logger';

export type DatabaseType = 'mssql' | 'postgres' | 'mysql';

export interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  poolMin?: number;
  poolMax?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

class DatabaseConnector {
  private config: DatabaseConfig;
  private mssqlPool: mssql.ConnectionPool | null = null;
  private pgPool: PgPool | null = null;
  private mysqlPool: mysql.Pool | null = null;
  private initialized = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing database connection', { type: this.config.type, host: this.config.host });

    try {
      switch (this.config.type) {
        case 'mssql':
          await this.initMssql();
          break;
        case 'postgres':
          await this.initPostgres();
          break;
        case 'mysql':
          await this.initMysql();
          break;
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }
      this.initialized = true;
      logger.info('Database connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection', { error });
      throw error;
    }
  }

  private async initMssql(): Promise<void> {
    const config: mssql.config = {
      server: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      pool: {
        min: this.config.poolMin || 2,
        max: this.config.poolMax || 10
      },
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
    this.mssqlPool = await mssql.connect(config);
  }

  private async initPostgres(): Promise<void> {
    this.pgPool = new PgPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      min: this.config.poolMin || 2,
      max: this.config.poolMax || 10
    });
    // Test connection
    const client = await this.pgPool.connect();
    client.release();
  }

  private async initMysql(): Promise<void> {
    this.mysqlPool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      connectionLimit: this.config.poolMax || 10,
      waitForConnections: true
    });
    // Test connection
    const conn = await this.mysqlPool.getConnection();
    conn.release();
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.debug('Executing query', { sql: sql.substring(0, 100) });

    try {
      switch (this.config.type) {
        case 'mssql':
          return await this.queryMssql(sql);
        case 'postgres':
          return await this.queryPostgres(sql);
        case 'mysql':
          return await this.queryMysql(sql);
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }
    } catch (error) {
      logger.error('Query execution failed', { error, sql: sql.substring(0, 100) });
      throw error;
    }
  }

  private async queryMssql(sql: string): Promise<QueryResult> {
    if (!this.mssqlPool) {
      throw new Error('MSSQL pool not initialized');
    }
    const result = await this.mssqlPool.request().query(sql);
    return {
      rows: result.recordset || [],
      rowCount: result.rowsAffected[0] || result.recordset?.length || 0
    };
  }

  private async queryPostgres(sql: string): Promise<QueryResult> {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    const result = await this.pgPool.query(sql);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0
    };
  }

  private async queryMysql(sql: string): Promise<QueryResult> {
    if (!this.mysqlPool) {
      throw new Error('MySQL pool not initialized');
    }
    const [rows] = await this.mysqlPool.execute(sql);
    const resultRows = Array.isArray(rows) ? rows : [];
    return {
      rows: resultRows as Record<string, unknown>[],
      rowCount: resultRows.length
    };
  }

  async listTables(): Promise<TableInfo[]> {
    let sql: string;

    switch (this.config.type) {
      case 'mssql':
        sql = `
          SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema, TABLE_TYPE as table_type
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;
        break;
      case 'postgres':
        sql = `
          SELECT table_name, table_schema, table_type
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_schema, table_name
        `;
        break;
      case 'mysql':
        sql = `
          SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema, TABLE_TYPE as table_type
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME
        `;
        break;
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }

    const result = await this.query(sql);
    return result.rows as TableInfo[];
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    let sql: string;

    switch (this.config.type) {
      case 'mssql':
        sql = `
          SELECT
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default,
            CHARACTER_MAXIMUM_LENGTH as character_maximum_length
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `;
        break;
      case 'postgres':
        sql = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `;
        break;
      case 'mysql':
        sql = `
          SELECT
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default,
            CHARACTER_MAXIMUM_LENGTH as character_maximum_length
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = DATABASE()
          ORDER BY ORDINAL_POSITION
        `;
        break;
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }

    const result = await this.query(sql);
    return result.rows as ColumnInfo[];
  }

  async getSampleData(tableName: string, limit: number = 10): Promise<QueryResult> {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error('Invalid table name');
    }

    // Validate limit
    const safeLimit = Math.min(Math.max(1, limit), 1000);

    let sql: string;

    switch (this.config.type) {
      case 'mssql':
        sql = `SELECT TOP ${safeLimit} * FROM [${tableName}]`;
        break;
      case 'postgres':
      case 'mysql':
        sql = `SELECT * FROM \`${tableName}\` LIMIT ${safeLimit}`;
        if (this.config.type === 'postgres') {
          sql = `SELECT * FROM "${tableName}" LIMIT ${safeLimit}`;
        }
        break;
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }

    return await this.query(sql);
  }

  async close(): Promise<void> {
    logger.info('Closing database connections');

    if (this.mssqlPool) {
      await this.mssqlPool.close();
      this.mssqlPool = null;
    }
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.mysqlPool) {
      await this.mysqlPool.end();
      this.mysqlPool = null;
    }

    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): DatabaseConfig {
    return { ...this.config, password: '***' };
  }
}

// Singleton instance
let connector: DatabaseConnector | null = null;

export function getConnector(): DatabaseConnector {
  if (!connector) {
    const config: DatabaseConfig = {
      type: (process.env.DB_TYPE as DatabaseType) || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'mydb',
      user: process.env.DB_USER || 'myuser',
      password: process.env.DB_PASSWORD || '',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10)
    };
    connector = new DatabaseConnector(config);
  }
  return connector;
}

export function resetConnector(): void {
  if (connector) {
    connector.close();
    connector = null;
  }
}

export default DatabaseConnector;
