import axios, { AxiosInstance } from 'axios';
import { logger } from '../server';

// Types for property management data
export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  type: 'residential' | 'commercial' | 'mixed' | 'industrial';
  status: 'active' | 'inactive' | 'pending';
  units_count: number;
  manager_id?: string;
  manager_name?: string;
  year_built?: number;
  square_footage?: number;
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  rent_amount: number;
  status: 'occupied' | 'vacant' | 'maintenance' | 'reserved';
  tenant_id?: string;
  lease_id?: string;
}

export interface Lease {
  id: string;
  property_id: string;
  unit_id: string;
  tenant_id: string;
  tenant_name: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  security_deposit: number;
  status: 'active' | 'expired' | 'pending' | 'terminated';
  renewal_status?: 'pending' | 'accepted' | 'declined' | 'not_offered';
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  current_property_id?: string;
  current_unit_id?: string;
  current_lease_id?: string;
  status: 'active' | 'inactive' | 'pending' | 'evicted';
  move_in_date?: string;
  balance: number;
  payment_history: PaymentRecord[];
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  tenant_id: string;
  amount: number;
  date: string;
  type: 'rent' | 'deposit' | 'fee' | 'other';
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  description?: string;
}

export interface WorkOrder {
  id: string;
  property_id: string;
  unit_id?: string;
  tenant_id?: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'landscaping' | 'cleaning' | 'other';
  priority: 'emergency' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  estimated_cost?: number;
  actual_cost?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface PropertyFinancials {
  property_id: string;
  period_start: string;
  period_end: string;
  gross_income: number;
  operating_expenses: number;
  net_operating_income: number;
  maintenance_costs: number;
  vacancy_loss: number;
  rent_collected: number;
  rent_expected: number;
  collection_rate: number;
}

export interface RentRollEntry {
  property_id: string;
  property_name: string;
  unit_id: string;
  unit_number: string;
  tenant_name: string;
  lease_start: string;
  lease_end: string;
  rent_amount: number;
  balance: number;
  status: string;
}

export interface VacancyEntry {
  property_id: string;
  property_name: string;
  unit_id: string;
  unit_number: string;
  days_vacant: number;
  market_rent: number;
  last_tenant_move_out?: string;
}

export interface PropertyManagementConfig {
  provider: 'appfolio' | 'buildium' | 'generic';
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  databaseName?: string;
  demoMode?: boolean;
}

export class PropertyManagementConnector {
  private client: AxiosInstance | null = null;
  private config: PropertyManagementConfig;
  private isConnected: boolean = false;

  constructor(config: PropertyManagementConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.config.demoMode) {
      logger.info('Property Management connector running in demo mode');
      this.isConnected = true;
      return;
    }

    logger.info('Connecting to Property Management system...', { provider: this.config.provider });

    try {
      switch (this.config.provider) {
        case 'appfolio':
          await this.connectAppFolio();
          break;
        case 'buildium':
          await this.connectBuildium();
          break;
        case 'generic':
          await this.connectGeneric();
          break;
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }
      this.isConnected = true;
      logger.info('Successfully connected to Property Management system');
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Property Management system', { error });
      throw error;
    }
  }

  private async connectAppFolio(): Promise<void> {
    this.client = axios.create({
      baseURL: `https://${this.config.databaseName}.appfolio.com/api/v1`,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async connectBuildium(): Promise<void> {
    // Buildium uses OAuth2
    const tokenResponse = await axios.post('https://api.buildium.com/oauth/token', {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    this.client = axios.create({
      baseURL: 'https://api.buildium.com/v1',
      headers: {
        'Authorization': `Bearer ${tokenResponse.data.access_token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async connectGeneric(): Promise<void> {
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  // Property operations
  async listProperties(filters?: {
    type?: string;
    status?: string;
    manager?: string;
  }): Promise<Property[]> {
    if (this.config.demoMode) {
      return this.getMockProperties(filters);
    }

    const response = await this.client!.get('/properties', { params: filters });
    return response.data;
  }

  async getProperty(propertyId: string): Promise<Property & { units: Unit[] }> {
    if (this.config.demoMode) {
      return this.getMockPropertyWithUnits(propertyId);
    }

    const [propertyResponse, unitsResponse] = await Promise.all([
      this.client!.get(`/properties/${propertyId}`),
      this.client!.get(`/properties/${propertyId}/units`),
    ]);

    return {
      ...propertyResponse.data,
      units: unitsResponse.data,
    };
  }

  async getPropertyFinancials(propertyId: string, startDate?: string, endDate?: string): Promise<PropertyFinancials> {
    if (this.config.demoMode) {
      return this.getMockFinancials(propertyId, startDate, endDate);
    }

    const response = await this.client!.get(`/properties/${propertyId}/financials`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  }

  async getVacancyReport(): Promise<VacancyEntry[]> {
    if (this.config.demoMode) {
      return this.getMockVacancies();
    }

    const response = await this.client!.get('/reports/vacancies');
    return response.data;
  }

  // Lease operations
  async listLeases(filters?: {
    property_id?: string;
    status?: string;
    expiring_in_days?: number;
  }): Promise<Lease[]> {
    if (this.config.demoMode) {
      return this.getMockLeases(filters);
    }

    const response = await this.client!.get('/leases', { params: filters });
    return response.data;
  }

  async getLease(leaseId: string): Promise<Lease> {
    if (this.config.demoMode) {
      return this.getMockLease(leaseId);
    }

    const response = await this.client!.get(`/leases/${leaseId}`);
    return response.data;
  }

  async getExpiringLeases(days: number): Promise<Lease[]> {
    if (this.config.demoMode) {
      return this.getMockLeases({ expiring_in_days: days });
    }

    const response = await this.client!.get('/leases', {
      params: { expiring_in_days: days, status: 'active' },
    });
    return response.data;
  }

  async getLeaseRenewals(): Promise<Lease[]> {
    if (this.config.demoMode) {
      return this.getMockLeases({}).filter(l => l.renewal_status === 'pending');
    }

    const response = await this.client!.get('/leases', {
      params: { renewal_status: 'pending' },
    });
    return response.data;
  }

  // Tenant operations
  async listTenants(filters?: {
    property_id?: string;
    status?: string;
  }): Promise<Tenant[]> {
    if (this.config.demoMode) {
      return this.getMockTenants(filters);
    }

    const response = await this.client!.get('/tenants', { params: filters });
    return response.data;
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    if (this.config.demoMode) {
      return this.getMockTenant(tenantId);
    }

    const response = await this.client!.get(`/tenants/${tenantId}`);
    return response.data;
  }

  async getDelinquentTenants(): Promise<Tenant[]> {
    if (this.config.demoMode) {
      return this.getMockTenants({}).filter(t => t.balance > 0);
    }

    const response = await this.client!.get('/tenants', {
      params: { delinquent: true },
    });
    return response.data;
  }

  async searchTenants(query: string): Promise<Tenant[]> {
    if (this.config.demoMode) {
      const allTenants = this.getMockTenants({});
      const lowerQuery = query.toLowerCase();
      return allTenants.filter(t =>
        t.first_name.toLowerCase().includes(lowerQuery) ||
        t.last_name.toLowerCase().includes(lowerQuery) ||
        t.email.toLowerCase().includes(lowerQuery) ||
        t.phone.includes(query)
      );
    }

    const response = await this.client!.get('/tenants/search', {
      params: { q: query },
    });
    return response.data;
  }

  // Work order operations
  async listWorkOrders(filters?: {
    property_id?: string;
    status?: string;
    priority?: string;
  }): Promise<WorkOrder[]> {
    if (this.config.demoMode) {
      return this.getMockWorkOrders(filters);
    }

    const response = await this.client!.get('/work-orders', { params: filters });
    return response.data;
  }

  async getWorkOrder(workOrderId: string): Promise<WorkOrder> {
    if (this.config.demoMode) {
      return this.getMockWorkOrder(workOrderId);
    }

    const response = await this.client!.get(`/work-orders/${workOrderId}`);
    return response.data;
  }

  async getOpenMaintenance(): Promise<WorkOrder[]> {
    if (this.config.demoMode) {
      return this.getMockWorkOrders({ status: 'open' })
        .concat(this.getMockWorkOrders({ status: 'in_progress' }));
    }

    const response = await this.client!.get('/work-orders', {
      params: { status: ['open', 'in_progress'] },
    });
    return response.data;
  }

  async getMaintenanceCosts(filters?: { property_id?: string; start_date?: string; end_date?: string }): Promise<{
    property_id: string;
    property_name: string;
    total_cost: number;
    work_orders_count: number;
    categories: { category: string; cost: number; count: number }[];
  }[]> {
    if (this.config.demoMode) {
      return this.getMockMaintenanceCosts(filters);
    }

    const response = await this.client!.get('/reports/maintenance-costs', { params: filters });
    return response.data;
  }

  // Financial operations
  async getRentRoll(propertyId?: string): Promise<RentRollEntry[]> {
    if (this.config.demoMode) {
      return this.getMockRentRoll(propertyId);
    }

    const response = await this.client!.get('/reports/rent-roll', {
      params: propertyId ? { property_id: propertyId } : {},
    });
    return response.data;
  }

  async getIncomeStatement(params: {
    property_id?: string;
    start_date: string;
    end_date: string;
  }): Promise<{
    period: { start: string; end: string };
    income: { category: string; amount: number }[];
    expenses: { category: string; amount: number }[];
    total_income: number;
    total_expenses: number;
    net_income: number;
  }> {
    if (this.config.demoMode) {
      return this.getMockIncomeStatement(params);
    }

    const response = await this.client!.get('/reports/income-statement', { params });
    return response.data;
  }

  async getCollectionsReport(): Promise<{
    total_expected: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    by_property: {
      property_id: string;
      property_name: string;
      expected: number;
      collected: number;
      outstanding: number;
    }[];
  }> {
    if (this.config.demoMode) {
      return this.getMockCollectionsReport();
    }

    const response = await this.client!.get('/reports/collections');
    return response.data;
  }

  // Mock data generators for demo mode
  private getMockProperties(filters?: { type?: string; status?: string; manager?: string }): Property[] {
    const properties: Property[] = [
      {
        id: 'PROP-001',
        name: 'Sunset Apartments',
        address: '123 Sunset Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90028',
        type: 'residential',
        status: 'active',
        units_count: 24,
        manager_id: 'MGR-001',
        manager_name: 'John Smith',
        year_built: 1985,
        square_footage: 28000,
        purchase_date: '2018-03-15',
        purchase_price: 4500000,
        current_value: 6200000,
        created_at: '2018-03-15T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'PROP-002',
        name: 'Downtown Office Plaza',
        address: '456 Main Street',
        city: 'San Francisco',
        state: 'CA',
        zip_code: '94102',
        type: 'commercial',
        status: 'active',
        units_count: 12,
        manager_id: 'MGR-002',
        manager_name: 'Sarah Johnson',
        year_built: 2005,
        square_footage: 45000,
        purchase_date: '2020-06-01',
        purchase_price: 12000000,
        current_value: 14500000,
        created_at: '2020-06-01T00:00:00Z',
        updated_at: '2024-01-08T00:00:00Z',
      },
      {
        id: 'PROP-003',
        name: 'Harbor View Condos',
        address: '789 Harbor Drive',
        city: 'San Diego',
        state: 'CA',
        zip_code: '92101',
        type: 'residential',
        status: 'active',
        units_count: 36,
        manager_id: 'MGR-001',
        manager_name: 'John Smith',
        year_built: 2015,
        square_footage: 42000,
        purchase_date: '2021-09-20',
        purchase_price: 8500000,
        current_value: 9800000,
        created_at: '2021-09-20T00:00:00Z',
        updated_at: '2024-01-12T00:00:00Z',
      },
    ];

    let result = properties;
    if (filters?.type) {
      result = result.filter(p => p.type === filters.type);
    }
    if (filters?.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (filters?.manager) {
      result = result.filter(p => p.manager_id === filters.manager || p.manager_name?.toLowerCase().includes(filters.manager!.toLowerCase()));
    }
    return result;
  }

  private getMockPropertyWithUnits(propertyId: string): Property & { units: Unit[] } {
    const property = this.getMockProperties({}).find(p => p.id === propertyId);
    if (!property) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    const units: Unit[] = [
      { id: 'UNIT-001', property_id: propertyId, unit_number: '101', bedrooms: 2, bathrooms: 1, square_footage: 950, rent_amount: 2200, status: 'occupied', tenant_id: 'TEN-001', lease_id: 'LEASE-001' },
      { id: 'UNIT-002', property_id: propertyId, unit_number: '102', bedrooms: 1, bathrooms: 1, square_footage: 750, rent_amount: 1800, status: 'occupied', tenant_id: 'TEN-002', lease_id: 'LEASE-002' },
      { id: 'UNIT-003', property_id: propertyId, unit_number: '103', bedrooms: 2, bathrooms: 2, square_footage: 1100, rent_amount: 2500, status: 'vacant' },
      { id: 'UNIT-004', property_id: propertyId, unit_number: '104', bedrooms: 3, bathrooms: 2, square_footage: 1400, rent_amount: 3200, status: 'occupied', tenant_id: 'TEN-003', lease_id: 'LEASE-003' },
      { id: 'UNIT-005', property_id: propertyId, unit_number: '201', bedrooms: 2, bathrooms: 1, square_footage: 950, rent_amount: 2200, status: 'maintenance' },
    ];

    return { ...property, units };
  }

  private getMockFinancials(propertyId: string, startDate?: string, endDate?: string): PropertyFinancials {
    return {
      property_id: propertyId,
      period_start: startDate || '2024-01-01',
      period_end: endDate || '2024-01-31',
      gross_income: 52400,
      operating_expenses: 18500,
      net_operating_income: 33900,
      maintenance_costs: 4200,
      vacancy_loss: 2500,
      rent_collected: 49900,
      rent_expected: 52400,
      collection_rate: 95.2,
    };
  }

  private getMockVacancies(): VacancyEntry[] {
    return [
      { property_id: 'PROP-001', property_name: 'Sunset Apartments', unit_id: 'UNIT-003', unit_number: '103', days_vacant: 15, market_rent: 2500, last_tenant_move_out: '2024-01-01' },
      { property_id: 'PROP-001', property_name: 'Sunset Apartments', unit_id: 'UNIT-005', unit_number: '201', days_vacant: 5, market_rent: 2200, last_tenant_move_out: '2024-01-11' },
      { property_id: 'PROP-003', property_name: 'Harbor View Condos', unit_id: 'UNIT-301', unit_number: '301', days_vacant: 30, market_rent: 2800, last_tenant_move_out: '2023-12-16' },
    ];
  }

  private getMockLeases(filters?: { property_id?: string; status?: string; expiring_in_days?: number }): Lease[] {
    const today = new Date();
    const leases: Lease[] = [
      {
        id: 'LEASE-001', property_id: 'PROP-001', unit_id: 'UNIT-001', tenant_id: 'TEN-001', tenant_name: 'Michael Brown',
        start_date: '2023-06-01', end_date: '2024-05-31', rent_amount: 2200, security_deposit: 2200,
        status: 'active', renewal_status: 'pending', created_at: '2023-05-15T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'LEASE-002', property_id: 'PROP-001', unit_id: 'UNIT-002', tenant_id: 'TEN-002', tenant_name: 'Emily Davis',
        start_date: '2023-09-01', end_date: '2024-02-28', rent_amount: 1800, security_deposit: 1800,
        status: 'active', renewal_status: 'not_offered', created_at: '2023-08-20T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'LEASE-003', property_id: 'PROP-001', unit_id: 'UNIT-004', tenant_id: 'TEN-003', tenant_name: 'Robert Wilson',
        start_date: '2022-12-01', end_date: '2024-11-30', rent_amount: 3200, security_deposit: 3200,
        status: 'active', created_at: '2022-11-15T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'LEASE-004', property_id: 'PROP-003', unit_id: 'UNIT-302', tenant_id: 'TEN-004', tenant_name: 'Jennifer Martinez',
        start_date: '2023-03-01', end_date: '2024-02-29', rent_amount: 2600, security_deposit: 2600,
        status: 'active', renewal_status: 'pending', created_at: '2023-02-20T00:00:00Z', updated_at: '2024-01-12T00:00:00Z',
      },
    ];

    let result = leases;
    if (filters?.property_id) {
      result = result.filter(l => l.property_id === filters.property_id);
    }
    if (filters?.status) {
      result = result.filter(l => l.status === filters.status);
    }
    if (filters?.expiring_in_days) {
      const expirationThreshold = new Date(today.getTime() + filters.expiring_in_days * 24 * 60 * 60 * 1000);
      result = result.filter(l => new Date(l.end_date) <= expirationThreshold && new Date(l.end_date) >= today);
    }
    return result;
  }

  private getMockLease(leaseId: string): Lease {
    const lease = this.getMockLeases({}).find(l => l.id === leaseId);
    if (!lease) {
      throw new Error(`Lease not found: ${leaseId}`);
    }
    return lease;
  }

  private getMockTenants(filters?: { property_id?: string; status?: string }): Tenant[] {
    const tenants: Tenant[] = [
      {
        id: 'TEN-001', first_name: 'Michael', last_name: 'Brown', email: 'michael.brown@email.com', phone: '555-0101',
        current_property_id: 'PROP-001', current_unit_id: 'UNIT-001', current_lease_id: 'LEASE-001',
        status: 'active', move_in_date: '2023-06-01', balance: 0,
        payment_history: [
          { id: 'PAY-001', tenant_id: 'TEN-001', amount: 2200, date: '2024-01-01', type: 'rent', status: 'completed' },
          { id: 'PAY-002', tenant_id: 'TEN-001', amount: 2200, date: '2023-12-01', type: 'rent', status: 'completed' },
        ],
        created_at: '2023-05-20T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'TEN-002', first_name: 'Emily', last_name: 'Davis', email: 'emily.davis@email.com', phone: '555-0102',
        current_property_id: 'PROP-001', current_unit_id: 'UNIT-002', current_lease_id: 'LEASE-002',
        status: 'active', move_in_date: '2023-09-01', balance: 450,
        payment_history: [
          { id: 'PAY-003', tenant_id: 'TEN-002', amount: 1350, date: '2024-01-05', type: 'rent', status: 'completed', description: 'Partial payment' },
          { id: 'PAY-004', tenant_id: 'TEN-002', amount: 1800, date: '2023-12-01', type: 'rent', status: 'completed' },
        ],
        created_at: '2023-08-25T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'TEN-003', first_name: 'Robert', last_name: 'Wilson', email: 'robert.wilson@email.com', phone: '555-0103',
        current_property_id: 'PROP-001', current_unit_id: 'UNIT-004', current_lease_id: 'LEASE-003',
        status: 'active', move_in_date: '2022-12-01', balance: 0,
        payment_history: [
          { id: 'PAY-005', tenant_id: 'TEN-003', amount: 3200, date: '2024-01-01', type: 'rent', status: 'completed' },
        ],
        created_at: '2022-11-20T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'TEN-004', first_name: 'Jennifer', last_name: 'Martinez', email: 'jennifer.martinez@email.com', phone: '555-0104',
        current_property_id: 'PROP-003', current_unit_id: 'UNIT-302', current_lease_id: 'LEASE-004',
        status: 'active', move_in_date: '2023-03-01', balance: 2600,
        payment_history: [
          { id: 'PAY-006', tenant_id: 'TEN-004', amount: 2600, date: '2023-12-01', type: 'rent', status: 'completed' },
        ],
        created_at: '2023-02-25T00:00:00Z', updated_at: '2024-01-12T00:00:00Z',
      },
    ];

    let result = tenants;
    if (filters?.property_id) {
      result = result.filter(t => t.current_property_id === filters.property_id);
    }
    if (filters?.status) {
      result = result.filter(t => t.status === filters.status);
    }
    return result;
  }

  private getMockTenant(tenantId: string): Tenant {
    const tenant = this.getMockTenants({}).find(t => t.id === tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    return tenant;
  }

  private getMockWorkOrders(filters?: { property_id?: string; status?: string; priority?: string }): WorkOrder[] {
    const workOrders: WorkOrder[] = [
      {
        id: 'WO-001', property_id: 'PROP-001', unit_id: 'UNIT-002', tenant_id: 'TEN-002',
        title: 'Leaking faucet in kitchen', description: 'Kitchen sink faucet is dripping constantly',
        category: 'plumbing', priority: 'medium', status: 'open',
        assigned_to: 'Mike Plumber', estimated_cost: 150,
        created_at: '2024-01-10T00:00:00Z', updated_at: '2024-01-10T00:00:00Z',
      },
      {
        id: 'WO-002', property_id: 'PROP-001', unit_id: 'UNIT-005',
        title: 'HVAC system not working', description: 'Unit 201 has no heat - HVAC system appears to be broken',
        category: 'hvac', priority: 'emergency', status: 'in_progress',
        assigned_to: 'HVAC Pros Inc.', estimated_cost: 800, actual_cost: 650,
        created_at: '2024-01-12T00:00:00Z', updated_at: '2024-01-14T00:00:00Z',
      },
      {
        id: 'WO-003', property_id: 'PROP-001',
        title: 'Parking lot light replacement', description: 'Three parking lot lights are out',
        category: 'electrical', priority: 'low', status: 'open',
        estimated_cost: 300,
        created_at: '2024-01-08T00:00:00Z', updated_at: '2024-01-08T00:00:00Z',
      },
      {
        id: 'WO-004', property_id: 'PROP-002',
        title: 'Elevator maintenance', description: 'Annual elevator inspection and maintenance',
        category: 'other', priority: 'medium', status: 'completed',
        assigned_to: 'Elevator Services Co.', estimated_cost: 1500, actual_cost: 1450,
        created_at: '2024-01-05T00:00:00Z', updated_at: '2024-01-09T00:00:00Z', completed_at: '2024-01-09T00:00:00Z',
      },
      {
        id: 'WO-005', property_id: 'PROP-003', unit_id: 'UNIT-301',
        title: 'Carpet cleaning before new tenant', description: 'Deep carpet cleaning needed for vacant unit',
        category: 'cleaning', priority: 'high', status: 'open',
        estimated_cost: 250,
        created_at: '2024-01-13T00:00:00Z', updated_at: '2024-01-13T00:00:00Z',
      },
    ];

    let result = workOrders;
    if (filters?.property_id) {
      result = result.filter(w => w.property_id === filters.property_id);
    }
    if (filters?.status) {
      result = result.filter(w => w.status === filters.status);
    }
    if (filters?.priority) {
      result = result.filter(w => w.priority === filters.priority);
    }
    return result;
  }

  private getMockWorkOrder(workOrderId: string): WorkOrder {
    const workOrder = this.getMockWorkOrders({}).find(w => w.id === workOrderId);
    if (!workOrder) {
      throw new Error(`Work order not found: ${workOrderId}`);
    }
    return workOrder;
  }

  private getMockMaintenanceCosts(filters?: { property_id?: string }): {
    property_id: string;
    property_name: string;
    total_cost: number;
    work_orders_count: number;
    categories: { category: string; cost: number; count: number }[];
  }[] {
    const costs = [
      {
        property_id: 'PROP-001', property_name: 'Sunset Apartments', total_cost: 4250,
        work_orders_count: 8,
        categories: [
          { category: 'plumbing', cost: 1200, count: 3 },
          { category: 'electrical', cost: 650, count: 2 },
          { category: 'hvac', cost: 1800, count: 2 },
          { category: 'cleaning', cost: 600, count: 1 },
        ],
      },
      {
        property_id: 'PROP-002', property_name: 'Downtown Office Plaza', total_cost: 6800,
        work_orders_count: 5,
        categories: [
          { category: 'hvac', cost: 3500, count: 2 },
          { category: 'electrical', cost: 1800, count: 2 },
          { category: 'other', cost: 1500, count: 1 },
        ],
      },
      {
        property_id: 'PROP-003', property_name: 'Harbor View Condos', total_cost: 3100,
        work_orders_count: 6,
        categories: [
          { category: 'plumbing', cost: 900, count: 2 },
          { category: 'appliance', cost: 1200, count: 2 },
          { category: 'cleaning', cost: 500, count: 1 },
          { category: 'landscaping', cost: 500, count: 1 },
        ],
      },
    ];

    if (filters?.property_id) {
      return costs.filter(c => c.property_id === filters.property_id);
    }
    return costs;
  }

  private getMockRentRoll(propertyId?: string): RentRollEntry[] {
    const rentRoll: RentRollEntry[] = [
      { property_id: 'PROP-001', property_name: 'Sunset Apartments', unit_id: 'UNIT-001', unit_number: '101', tenant_name: 'Michael Brown', lease_start: '2023-06-01', lease_end: '2024-05-31', rent_amount: 2200, balance: 0, status: 'current' },
      { property_id: 'PROP-001', property_name: 'Sunset Apartments', unit_id: 'UNIT-002', unit_number: '102', tenant_name: 'Emily Davis', lease_start: '2023-09-01', lease_end: '2024-02-28', rent_amount: 1800, balance: 450, status: 'delinquent' },
      { property_id: 'PROP-001', property_name: 'Sunset Apartments', unit_id: 'UNIT-004', unit_number: '104', tenant_name: 'Robert Wilson', lease_start: '2022-12-01', lease_end: '2024-11-30', rent_amount: 3200, balance: 0, status: 'current' },
      { property_id: 'PROP-003', property_name: 'Harbor View Condos', unit_id: 'UNIT-302', unit_number: '302', tenant_name: 'Jennifer Martinez', lease_start: '2023-03-01', lease_end: '2024-02-29', rent_amount: 2600, balance: 2600, status: 'delinquent' },
    ];

    if (propertyId) {
      return rentRoll.filter(r => r.property_id === propertyId);
    }
    return rentRoll;
  }

  private getMockIncomeStatement(params: { property_id?: string; start_date: string; end_date: string }): {
    period: { start: string; end: string };
    income: { category: string; amount: number }[];
    expenses: { category: string; amount: number }[];
    total_income: number;
    total_expenses: number;
    net_income: number;
  } {
    return {
      period: { start: params.start_date, end: params.end_date },
      income: [
        { category: 'Rental Income', amount: 52400 },
        { category: 'Late Fees', amount: 350 },
        { category: 'Application Fees', amount: 200 },
        { category: 'Parking Income', amount: 1200 },
        { category: 'Laundry Income', amount: 450 },
      ],
      expenses: [
        { category: 'Property Management', amount: 5240 },
        { category: 'Maintenance & Repairs', amount: 4200 },
        { category: 'Utilities', amount: 2800 },
        { category: 'Insurance', amount: 1500 },
        { category: 'Property Taxes', amount: 3200 },
        { category: 'Landscaping', amount: 800 },
        { category: 'Advertising', amount: 350 },
      ],
      total_income: 54600,
      total_expenses: 18090,
      net_income: 36510,
    };
  }

  private getMockCollectionsReport(): {
    total_expected: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    by_property: {
      property_id: string;
      property_name: string;
      expected: number;
      collected: number;
      outstanding: number;
    }[];
  } {
    return {
      total_expected: 52400,
      total_collected: 49350,
      total_outstanding: 3050,
      collection_rate: 94.2,
      by_property: [
        { property_id: 'PROP-001', property_name: 'Sunset Apartments', expected: 24000, collected: 23550, outstanding: 450 },
        { property_id: 'PROP-002', property_name: 'Downtown Office Plaza', expected: 18000, collected: 18000, outstanding: 0 },
        { property_id: 'PROP-003', property_name: 'Harbor View Condos', expected: 10400, collected: 7800, outstanding: 2600 },
      ],
    };
  }
}

let propertyConnector: PropertyManagementConnector | null = null;

export function initializePropertyConnector(config: PropertyManagementConfig): PropertyManagementConnector {
  propertyConnector = new PropertyManagementConnector(config);
  return propertyConnector;
}

export function getPropertyConnector(): PropertyManagementConnector {
  if (!propertyConnector) {
    throw new Error('Property Management connector not initialized. Call initializePropertyConnector first.');
  }
  return propertyConnector;
}
