import jsforce, { Connection, OAuth2 } from 'jsforce';
import { logger } from '../server';

// ============================================
// Types and Interfaces
// ============================================

export type CrmProvider = 'salesforce' | 'd365' | 'generic';

export interface SalesforceConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface D365Config {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  resourceUrl: string;
}

export interface GenericConfig {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
}

export interface CrmConfig {
  provider: CrmProvider;
  salesforce?: SalesforceConfig;
  d365?: D365Config;
  generic?: GenericConfig;
}

// Standard pipeline stage
export interface PipelineStage {
  name: string;
  probability: number;
  order: number;
}

// Standard opportunity/deal record
export interface Opportunity {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  closeDate: Date;
  createdDate: Date;
  lastModifiedDate: Date;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  accountId?: string;
  accountName?: string;
  segment?: string;
  region?: string;
  type?: string;
  forecastCategory?: string;
  isClosed: boolean;
  isWon: boolean;
  lastActivityDate?: Date;
  daysInStage?: number;
  riskFlag?: boolean;
  riskReason?: string;
}

// Activity record
export interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'other';
  subject: string;
  date: Date;
  ownerId: string;
  ownerName: string;
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  opportunityName?: string;
  duration?: number;
}

// Sales rep/user record
export interface SalesRep {
  id: string;
  name: string;
  email: string;
  team?: string;
  quota?: number;
  quotaPeriod?: string;
}

// Forecast record
export interface ForecastRecord {
  repId: string;
  repName: string;
  period: string;
  commit: number;
  mostLikely: number;
  bestCase: number;
  quota: number;
  closed: number;
}

// ============================================
// CRM Connector Abstract Class
// ============================================

export abstract class CrmConnector {
  protected isConnected: boolean = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnectionActive(): boolean;

  // Pipeline methods
  abstract getOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]>;
  abstract getOpportunityById(id: string): Promise<Opportunity | null>;
  abstract getPipelineStages(): Promise<PipelineStage[]>;

  // Activity methods
  abstract getActivities(filters?: ActivityFilters): Promise<Activity[]>;
  abstract getActivityCountByRep(startDate: Date, endDate: Date): Promise<RepActivitySummary[]>;

  // User/rep methods
  abstract getSalesReps(): Promise<SalesRep[]>;
  abstract getRepById(id: string): Promise<SalesRep | null>;

  // Forecast methods
  abstract getForecasts(period: string): Promise<ForecastRecord[]>;
}

export interface OpportunityFilters {
  ownerId?: string;
  ownerEmail?: string;
  stage?: string;
  segment?: string;
  region?: string;
  minAmount?: number;
  maxAmount?: number;
  closeDateStart?: Date;
  closeDateEnd?: Date;
  isClosed?: boolean;
  isWon?: boolean;
  hasActivitySince?: Date;
  noActivitySince?: Date;
  limit?: number;
}

export interface ActivityFilters {
  type?: string;
  ownerId?: string;
  accountId?: string;
  opportunityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface RepActivitySummary {
  repId: string;
  repName: string;
  calls: number;
  emails: number;
  meetings: number;
  tasks: number;
  total: number;
}

// ============================================
// Salesforce Connector Implementation
// ============================================

export class SalesforceConnector extends CrmConnector {
  private connection: Connection | null = null;
  private oauth2: OAuth2;
  private config: SalesforceConfig;

  constructor(config: SalesforceConfig) {
    super();
    this.config = config;
    this.oauth2 = new jsforce.OAuth2({
      loginUrl: config.loginUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  async connect(): Promise<void> {
    if (this.connection && this.isConnected) {
      return;
    }

    logger.info('Connecting to Salesforce...');

    this.connection = new jsforce.Connection({
      oauth2: this.oauth2,
      loginUrl: this.config.loginUrl,
    });

    try {
      await this.connection.login(this.config.username, this.config.password);
      this.isConnected = true;
      logger.info('Successfully connected to Salesforce', {
        instanceUrl: this.connection.instanceUrl,
        userId: this.connection.userInfo?.id,
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Salesforce', { error });
      throw error;
    }
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

  private async getConnection(): Promise<Connection> {
    if (!this.connection || !this.isConnected) {
      await this.connect();
    }
    return this.connection!;
  }

  private async query<T>(soql: string): Promise<T[]> {
    const conn = await this.getConnection();
    const result = await conn.query<T>(soql);
    return result.records;
  }

  async getOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    const conditions: string[] = [];

    if (filters?.ownerId) {
      conditions.push(`OwnerId = '${this.escape(filters.ownerId)}'`);
    }
    if (filters?.ownerEmail) {
      conditions.push(`Owner.Email = '${this.escape(filters.ownerEmail)}'`);
    }
    if (filters?.stage) {
      conditions.push(`StageName = '${this.escape(filters.stage)}'`);
    }
    if (filters?.isClosed !== undefined) {
      conditions.push(`IsClosed = ${filters.isClosed}`);
    }
    if (filters?.isWon !== undefined) {
      conditions.push(`IsWon = ${filters.isWon}`);
    }
    if (filters?.closeDateStart) {
      conditions.push(`CloseDate >= ${filters.closeDateStart.toISOString().split('T')[0]}`);
    }
    if (filters?.closeDateEnd) {
      conditions.push(`CloseDate <= ${filters.closeDateEnd.toISOString().split('T')[0]}`);
    }
    if (filters?.minAmount !== undefined) {
      conditions.push(`Amount >= ${filters.minAmount}`);
    }
    if (filters?.maxAmount !== undefined) {
      conditions.push(`Amount <= ${filters.maxAmount}`);
    }
    if (filters?.noActivitySince) {
      conditions.push(
        `LastActivityDate < ${filters.noActivitySince.toISOString().split('T')[0]}`
      );
    }
    if (filters?.hasActivitySince) {
      conditions.push(
        `LastActivityDate >= ${filters.hasActivitySince.toISOString().split('T')[0]}`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : 'LIMIT 200';

    const soql = `
      SELECT Id, Name, Amount, StageName, Probability, CloseDate, CreatedDate,
             LastModifiedDate, OwnerId, Owner.Name, Owner.Email, AccountId, Account.Name,
             Type, ForecastCategory, IsClosed, IsWon, LastActivityDate
      FROM Opportunity
      ${whereClause}
      ORDER BY Amount DESC NULLS LAST
      ${limitClause}
    `;

    interface SfOpportunity {
      Id: string;
      Name: string;
      Amount: number | null;
      StageName: string;
      Probability: number | null;
      CloseDate: string;
      CreatedDate: string;
      LastModifiedDate: string;
      OwnerId: string;
      Owner?: { Name: string; Email?: string };
      AccountId?: string;
      Account?: { Name: string };
      Type?: string;
      ForecastCategory?: string;
      IsClosed: boolean;
      IsWon: boolean;
      LastActivityDate?: string;
    }

    const records = await this.query<SfOpportunity>(soql);

    return records.map((r) => ({
      id: r.Id,
      name: r.Name,
      amount: r.Amount || 0,
      stage: r.StageName,
      probability: r.Probability || 0,
      closeDate: new Date(r.CloseDate),
      createdDate: new Date(r.CreatedDate),
      lastModifiedDate: new Date(r.LastModifiedDate),
      ownerId: r.OwnerId,
      ownerName: r.Owner?.Name || 'Unknown',
      ownerEmail: r.Owner?.Email,
      accountId: r.AccountId,
      accountName: r.Account?.Name,
      type: r.Type,
      forecastCategory: r.ForecastCategory,
      isClosed: r.IsClosed,
      isWon: r.IsWon,
      lastActivityDate: r.LastActivityDate ? new Date(r.LastActivityDate) : undefined,
    }));
  }

  async getOpportunityById(id: string): Promise<Opportunity | null> {
    const opps = await this.getOpportunities({ limit: 1 });
    // For a real implementation, add ID filter
    const soql = `
      SELECT Id, Name, Amount, StageName, Probability, CloseDate, CreatedDate,
             LastModifiedDate, OwnerId, Owner.Name, Owner.Email, AccountId, Account.Name,
             Type, ForecastCategory, IsClosed, IsWon, LastActivityDate
      FROM Opportunity
      WHERE Id = '${this.escape(id)}'
    `;

    interface SfOpportunity {
      Id: string;
      Name: string;
      Amount: number | null;
      StageName: string;
      Probability: number | null;
      CloseDate: string;
      CreatedDate: string;
      LastModifiedDate: string;
      OwnerId: string;
      Owner?: { Name: string; Email?: string };
      AccountId?: string;
      Account?: { Name: string };
      Type?: string;
      ForecastCategory?: string;
      IsClosed: boolean;
      IsWon: boolean;
      LastActivityDate?: string;
    }

    const records = await this.query<SfOpportunity>(soql);

    if (records.length === 0) return null;

    const r = records[0];
    return {
      id: r.Id,
      name: r.Name,
      amount: r.Amount || 0,
      stage: r.StageName,
      probability: r.Probability || 0,
      closeDate: new Date(r.CloseDate),
      createdDate: new Date(r.CreatedDate),
      lastModifiedDate: new Date(r.LastModifiedDate),
      ownerId: r.OwnerId,
      ownerName: r.Owner?.Name || 'Unknown',
      ownerEmail: r.Owner?.Email,
      accountId: r.AccountId,
      accountName: r.Account?.Name,
      type: r.Type,
      forecastCategory: r.ForecastCategory,
      isClosed: r.IsClosed,
      isWon: r.IsWon,
      lastActivityDate: r.LastActivityDate ? new Date(r.LastActivityDate) : undefined,
    };
  }

  async getPipelineStages(): Promise<PipelineStage[]> {
    // Standard Salesforce stages - in production, query OpportunityStage metadata
    return [
      { name: 'Prospecting', probability: 10, order: 1 },
      { name: 'Qualification', probability: 20, order: 2 },
      { name: 'Needs Analysis', probability: 30, order: 3 },
      { name: 'Value Proposition', probability: 40, order: 4 },
      { name: 'Id. Decision Makers', probability: 50, order: 5 },
      { name: 'Perception Analysis', probability: 60, order: 6 },
      { name: 'Proposal/Price Quote', probability: 70, order: 7 },
      { name: 'Negotiation/Review', probability: 80, order: 8 },
      { name: 'Closed Won', probability: 100, order: 9 },
      { name: 'Closed Lost', probability: 0, order: 10 },
    ];
  }

  async getActivities(filters?: ActivityFilters): Promise<Activity[]> {
    const conditions: string[] = [];

    if (filters?.ownerId) {
      conditions.push(`OwnerId = '${this.escape(filters.ownerId)}'`);
    }
    if (filters?.accountId) {
      conditions.push(`AccountId = '${this.escape(filters.accountId)}'`);
    }
    if (filters?.opportunityId) {
      conditions.push(`WhatId = '${this.escape(filters.opportunityId)}'`);
    }
    if (filters?.startDate) {
      conditions.push(`ActivityDate >= ${filters.startDate.toISOString().split('T')[0]}`);
    }
    if (filters?.endDate) {
      conditions.push(`ActivityDate <= ${filters.endDate.toISOString().split('T')[0]}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters?.limit ? `LIMIT ${filters.limit}` : 'LIMIT 200';

    // Query Tasks (includes Calls)
    const taskSoql = `
      SELECT Id, Subject, ActivityDate, OwnerId, Owner.Name, AccountId, Account.Name,
             WhatId, What.Name, CallDurationInSeconds, TaskSubtype
      FROM Task
      ${whereClause}
      ORDER BY ActivityDate DESC
      ${limitClause}
    `;

    // Query Events (Meetings)
    const eventSoql = `
      SELECT Id, Subject, ActivityDate, OwnerId, Owner.Name, AccountId, Account.Name,
             WhatId, What.Name, DurationInMinutes
      FROM Event
      ${whereClause}
      ORDER BY ActivityDate DESC
      ${limitClause}
    `;

    interface SfTask {
      Id: string;
      Subject: string;
      ActivityDate: string;
      OwnerId: string;
      Owner?: { Name: string };
      AccountId?: string;
      Account?: { Name: string };
      WhatId?: string;
      What?: { Name: string };
      CallDurationInSeconds?: number;
      TaskSubtype?: string;
    }

    interface SfEvent {
      Id: string;
      Subject: string;
      ActivityDate: string;
      OwnerId: string;
      Owner?: { Name: string };
      AccountId?: string;
      Account?: { Name: string };
      WhatId?: string;
      What?: { Name: string };
      DurationInMinutes?: number;
    }

    const [tasks, events] = await Promise.all([
      this.query<SfTask>(taskSoql),
      this.query<SfEvent>(eventSoql),
    ]);

    const activities: Activity[] = [];

    for (const t of tasks) {
      let type: Activity['type'] = 'task';
      if (t.TaskSubtype === 'Call' || t.Subject?.toLowerCase().includes('call')) {
        type = 'call';
      } else if (t.TaskSubtype === 'Email' || t.Subject?.toLowerCase().includes('email')) {
        type = 'email';
      }

      activities.push({
        id: t.Id,
        type,
        subject: t.Subject,
        date: new Date(t.ActivityDate),
        ownerId: t.OwnerId,
        ownerName: t.Owner?.Name || 'Unknown',
        accountId: t.AccountId,
        accountName: t.Account?.Name,
        opportunityId: t.WhatId,
        opportunityName: t.What?.Name,
        duration: t.CallDurationInSeconds ? Math.ceil(t.CallDurationInSeconds / 60) : undefined,
      });
    }

    for (const e of events) {
      activities.push({
        id: e.Id,
        type: 'meeting',
        subject: e.Subject,
        date: new Date(e.ActivityDate),
        ownerId: e.OwnerId,
        ownerName: e.Owner?.Name || 'Unknown',
        accountId: e.AccountId,
        accountName: e.Account?.Name,
        opportunityId: e.WhatId,
        opportunityName: e.What?.Name,
        duration: e.DurationInMinutes,
      });
    }

    return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getActivityCountByRep(startDate: Date, endDate: Date): Promise<RepActivitySummary[]> {
    const dateFilter = `ActivityDate >= ${startDate.toISOString().split('T')[0]} AND ActivityDate <= ${endDate.toISOString().split('T')[0]}`;

    const taskSoql = `
      SELECT OwnerId, Owner.Name, TaskSubtype, COUNT(Id) cnt
      FROM Task
      WHERE ${dateFilter}
      GROUP BY OwnerId, Owner.Name, TaskSubtype
    `;

    const eventSoql = `
      SELECT OwnerId, Owner.Name, COUNT(Id) cnt
      FROM Event
      WHERE ${dateFilter}
      GROUP BY OwnerId, Owner.Name
    `;

    interface TaskAgg {
      OwnerId: string;
      Owner?: { Name: string };
      TaskSubtype?: string;
      cnt: number;
    }

    interface EventAgg {
      OwnerId: string;
      Owner?: { Name: string };
      cnt: number;
    }

    const [taskAggs, eventAggs] = await Promise.all([
      this.query<TaskAgg>(taskSoql),
      this.query<EventAgg>(eventSoql),
    ]);

    const repMap = new Map<string, RepActivitySummary>();

    for (const t of taskAggs) {
      if (!repMap.has(t.OwnerId)) {
        repMap.set(t.OwnerId, {
          repId: t.OwnerId,
          repName: t.Owner?.Name || 'Unknown',
          calls: 0,
          emails: 0,
          meetings: 0,
          tasks: 0,
          total: 0,
        });
      }
      const rep = repMap.get(t.OwnerId)!;
      if (t.TaskSubtype === 'Call') {
        rep.calls += t.cnt;
      } else if (t.TaskSubtype === 'Email') {
        rep.emails += t.cnt;
      } else {
        rep.tasks += t.cnt;
      }
      rep.total += t.cnt;
    }

    for (const e of eventAggs) {
      if (!repMap.has(e.OwnerId)) {
        repMap.set(e.OwnerId, {
          repId: e.OwnerId,
          repName: e.Owner?.Name || 'Unknown',
          calls: 0,
          emails: 0,
          meetings: 0,
          tasks: 0,
          total: 0,
        });
      }
      const rep = repMap.get(e.OwnerId)!;
      rep.meetings += e.cnt;
      rep.total += e.cnt;
    }

    return Array.from(repMap.values());
  }

  async getSalesReps(): Promise<SalesRep[]> {
    const soql = `
      SELECT Id, Name, Email, Department
      FROM User
      WHERE IsActive = true AND UserType = 'Standard'
      ORDER BY Name
      LIMIT 200
    `;

    interface SfUser {
      Id: string;
      Name: string;
      Email: string;
      Department?: string;
    }

    const users = await this.query<SfUser>(soql);

    return users.map((u) => ({
      id: u.Id,
      name: u.Name,
      email: u.Email,
      team: u.Department,
    }));
  }

  async getRepById(id: string): Promise<SalesRep | null> {
    const soql = `
      SELECT Id, Name, Email, Department
      FROM User
      WHERE Id = '${this.escape(id)}'
    `;

    interface SfUser {
      Id: string;
      Name: string;
      Email: string;
      Department?: string;
    }

    const users = await this.query<SfUser>(soql);

    if (users.length === 0) return null;

    const u = users[0];
    return {
      id: u.Id,
      name: u.Name,
      email: u.Email,
      team: u.Department,
    };
  }

  async getForecasts(period: string): Promise<ForecastRecord[]> {
    // Salesforce Collaborative Forecasting query
    // In production, query ForecastingQuota, ForecastingItem, etc.
    // For now, return derived data from opportunities

    const periodStart = this.getPeriodStart(period);
    const periodEnd = this.getPeriodEnd(period);

    const opps = await this.getOpportunities({
      closeDateStart: periodStart,
      closeDateEnd: periodEnd,
    });

    // Aggregate by owner
    const repMap = new Map<
      string,
      { name: string; commit: number; mostLikely: number; bestCase: number; closed: number }
    >();

    for (const opp of opps) {
      if (!repMap.has(opp.ownerId)) {
        repMap.set(opp.ownerId, {
          name: opp.ownerName,
          commit: 0,
          mostLikely: 0,
          bestCase: 0,
          closed: 0,
        });
      }

      const rep = repMap.get(opp.ownerId)!;

      if (opp.isClosed && opp.isWon) {
        rep.closed += opp.amount;
      } else if (!opp.isClosed) {
        // Categorize based on forecast category or probability
        if (opp.forecastCategory === 'Commit' || opp.probability >= 90) {
          rep.commit += opp.amount;
        } else if (opp.forecastCategory === 'Best Case' || opp.probability >= 50) {
          rep.bestCase += opp.amount;
        }
        rep.mostLikely += opp.amount * (opp.probability / 100);
      }
    }

    return Array.from(repMap.entries()).map(([repId, data]) => ({
      repId,
      repName: data.name,
      period,
      commit: data.commit,
      mostLikely: data.mostLikely,
      bestCase: data.bestCase + data.commit,
      quota: 0, // Would need to query quota objects
      closed: data.closed,
    }));
  }

  private escape(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  private getPeriodStart(period: string): Date {
    // Parse period like "2024-Q1", "2024-01", "2024"
    const now = new Date();
    if (period.includes('Q')) {
      const [year, q] = period.split('-Q');
      const quarter = parseInt(q, 10);
      const month = (quarter - 1) * 3;
      return new Date(parseInt(year, 10), month, 1);
    } else if (period.length === 7) {
      const [year, month] = period.split('-');
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    } else {
      return new Date(parseInt(period, 10), 0, 1);
    }
  }

  private getPeriodEnd(period: string): Date {
    const start = this.getPeriodStart(period);
    if (period.includes('Q')) {
      return new Date(start.getFullYear(), start.getMonth() + 3, 0);
    } else if (period.length === 7) {
      return new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else {
      return new Date(start.getFullYear(), 11, 31);
    }
  }
}

// ============================================
// D365 Connector Implementation (Stub)
// ============================================

export class D365Connector extends CrmConnector {
  private config: D365Config;
  private accessToken: string | null = null;

  constructor(config: D365Config) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to Dynamics 365 Sales...');

    // In production, implement OAuth2 client credentials flow
    // using @azure/identity or similar library
    try {
      // Placeholder - would use Azure AD token endpoint
      const tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

      // For now, mark as connected (actual implementation would fetch token)
      this.isConnected = true;
      logger.info('Successfully connected to Dynamics 365 Sales');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Dynamics 365', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.isConnected = false;
    logger.info('Disconnected from Dynamics 365');
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  // Implement D365-specific queries using Web API
  async getOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    // D365 Web API endpoint: /api/data/v9.2/opportunities
    // Would use OData query syntax
    logger.info('D365: Getting opportunities', { filters });
    return [];
  }

  async getOpportunityById(id: string): Promise<Opportunity | null> {
    logger.info('D365: Getting opportunity by ID', { id });
    return null;
  }

  async getPipelineStages(): Promise<PipelineStage[]> {
    // D365 uses business process flows and option sets
    return [
      { name: 'Qualify', probability: 10, order: 1 },
      { name: 'Develop', probability: 30, order: 2 },
      { name: 'Propose', probability: 60, order: 3 },
      { name: 'Close', probability: 80, order: 4 },
      { name: 'Won', probability: 100, order: 5 },
      { name: 'Lost', probability: 0, order: 6 },
    ];
  }

  async getActivities(filters?: ActivityFilters): Promise<Activity[]> {
    logger.info('D365: Getting activities', { filters });
    return [];
  }

  async getActivityCountByRep(startDate: Date, endDate: Date): Promise<RepActivitySummary[]> {
    logger.info('D365: Getting activity counts', { startDate, endDate });
    return [];
  }

  async getSalesReps(): Promise<SalesRep[]> {
    // D365: Query systemuser entity
    return [];
  }

  async getRepById(id: string): Promise<SalesRep | null> {
    return null;
  }

  async getForecasts(period: string): Promise<ForecastRecord[]> {
    // D365: Query msdyn_forecastinstance
    return [];
  }
}

// ============================================
// Generic CRM Connector (Stub)
// ============================================

export class GenericCrmConnector extends CrmConnector {
  private config: GenericConfig;

  constructor(config: GenericConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to Generic CRM API...');
    this.isConnected = true;
    logger.info('Successfully connected to Generic CRM');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Disconnected from Generic CRM');
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  async getOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    // Would call generic REST API
    return [];
  }

  async getOpportunityById(id: string): Promise<Opportunity | null> {
    return null;
  }

  async getPipelineStages(): Promise<PipelineStage[]> {
    return [
      { name: 'Lead', probability: 10, order: 1 },
      { name: 'Qualified', probability: 25, order: 2 },
      { name: 'Proposal', probability: 50, order: 3 },
      { name: 'Negotiation', probability: 75, order: 4 },
      { name: 'Won', probability: 100, order: 5 },
      { name: 'Lost', probability: 0, order: 6 },
    ];
  }

  async getActivities(filters?: ActivityFilters): Promise<Activity[]> {
    return [];
  }

  async getActivityCountByRep(startDate: Date, endDate: Date): Promise<RepActivitySummary[]> {
    return [];
  }

  async getSalesReps(): Promise<SalesRep[]> {
    return [];
  }

  async getRepById(id: string): Promise<SalesRep | null> {
    return null;
  }

  async getForecasts(period: string): Promise<ForecastRecord[]> {
    return [];
  }
}

// ============================================
// Factory and Singleton
// ============================================

let crmConnector: CrmConnector | null = null;

export function initializeCrmConnector(config: CrmConfig): CrmConnector {
  switch (config.provider) {
    case 'salesforce':
      if (!config.salesforce) {
        throw new Error('Salesforce config required when provider is salesforce');
      }
      crmConnector = new SalesforceConnector(config.salesforce);
      break;
    case 'd365':
      if (!config.d365) {
        throw new Error('D365 config required when provider is d365');
      }
      crmConnector = new D365Connector(config.d365);
      break;
    case 'generic':
      if (!config.generic) {
        throw new Error('Generic config required when provider is generic');
      }
      crmConnector = new GenericCrmConnector(config.generic);
      break;
    default:
      throw new Error(`Unknown CRM provider: ${config.provider}`);
  }

  return crmConnector;
}

export function getCrmConnector(): CrmConnector {
  if (!crmConnector) {
    throw new Error('CRM connector not initialized. Call initializeCrmConnector first.');
  }
  return crmConnector;
}
