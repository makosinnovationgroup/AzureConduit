import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface WorkOrder {
  work_order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_completed: number;
  quantity_remaining: number;
  status: 'planned' | 'released' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  line_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  customer_order: string | null;
  customer_name: string | null;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  material_id: string;
  material_name: string;
  description: string;
  unit_of_measure: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  safety_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  location: string;
  lot_number: string | null;
  expiration_date: string | null;
  unit_cost: number;
  last_receipt_date: string;
  last_issue_date: string;
}

export interface WIPInventory {
  wip_id: string;
  work_order_id: string;
  product_id: string;
  product_name: string;
  operation: string;
  quantity: number;
  location: string;
  status: 'in_process' | 'waiting' | 'on_hold' | 'inspection';
  started_at: string;
  estimated_completion: string;
}

export interface FinishedGoods {
  item_id: string;
  product_id: string;
  product_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  lot_number: string;
  production_date: string;
  expiration_date: string | null;
  location: string;
  quality_status: 'released' | 'hold' | 'quarantine' | 'rejected';
  unit_cost: number;
}

export interface MaterialShortage {
  material_id: string;
  material_name: string;
  quantity_on_hand: number;
  safety_stock: number;
  shortage_quantity: number;
  affected_work_orders: string[];
  projected_stockout_date: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ERPConfig {
  baseUrl: string;
  apiKey: string;
  companyId: string;
}

class ERPConnector {
  private config: ERPConfig;
  private client: AxiosInstance;
  private initialized = false;

  constructor(config: ERPConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Company-ID': config.companyId
      },
      timeout: 30000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing ERP connector', {
      baseUrl: this.config.baseUrl,
      companyId: this.config.companyId
    });

    try {
      await this.client.get('/api/v1/health');
      this.initialized = true;
      logger.info('ERP connector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ERP connector', { error });
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getWorkOrderStatus(workOrderId: string): Promise<WorkOrder> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting work order status', { workOrderId });

    try {
      const response = await this.client.get(`/api/v1/work-orders/${workOrderId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get work order status', { error });
      return this.getMockWorkOrder(workOrderId);
    }
  }

  async listWorkOrders(params: {
    line_id?: string;
    status?: string;
    date?: string;
  }): Promise<{
    work_orders: WorkOrder[];
    total_count: number;
    summary: {
      planned: number;
      released: number;
      in_progress: number;
      completed: number;
      on_hold: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Listing work orders', params);

    try {
      const response = await this.client.get('/api/v1/work-orders', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to list work orders', { error });
      return this.getMockWorkOrderList(params);
    }
  }

  async getRawMaterialLevels(): Promise<{
    materials: RawMaterial[];
    summary: {
      total_items: number;
      below_safety_stock: number;
      below_reorder_point: number;
      total_inventory_value: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting raw material levels');

    try {
      const response = await this.client.get('/api/v1/inventory/raw-materials');
      return response.data;
    } catch (error) {
      logger.error('Failed to get raw material levels', { error });
      return this.getMockRawMaterials();
    }
  }

  async getWIPInventory(): Promise<{
    wip_items: WIPInventory[];
    summary: {
      total_items: number;
      in_process: number;
      waiting: number;
      on_hold: number;
      total_value: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting WIP inventory');

    try {
      const response = await this.client.get('/api/v1/inventory/wip');
      return response.data;
    } catch (error) {
      logger.error('Failed to get WIP inventory', { error });
      return this.getMockWIPInventory();
    }
  }

  async getFinishedGoods(): Promise<{
    items: FinishedGoods[];
    summary: {
      total_items: number;
      total_quantity: number;
      on_hold: number;
      total_value: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting finished goods inventory');

    try {
      const response = await this.client.get('/api/v1/inventory/finished-goods');
      return response.data;
    } catch (error) {
      logger.error('Failed to get finished goods inventory', { error });
      return this.getMockFinishedGoods();
    }
  }

  async getMaterialShortages(): Promise<{
    shortages: MaterialShortage[];
    summary: {
      total_shortages: number;
      critical: number;
      high: number;
      affected_work_orders: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting material shortages');

    try {
      const response = await this.client.get('/api/v1/inventory/shortages');
      return response.data;
    } catch (error) {
      logger.error('Failed to get material shortages', { error });
      return this.getMockShortages();
    }
  }

  // Mock data methods
  private getMockWorkOrder(workOrderId: string): WorkOrder {
    return {
      work_order_id: workOrderId,
      order_number: 'WO-2024-0001',
      product_id: 'PROD-A1234',
      product_name: 'Widget Assembly A',
      quantity_ordered: 1000,
      quantity_completed: 892,
      quantity_remaining: 108,
      status: 'in_progress',
      priority: 'high',
      line_id: 'LINE-001',
      scheduled_start: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      actual_start: new Date(Date.now() - 5.75 * 60 * 60 * 1000).toISOString(),
      actual_end: null,
      customer_order: 'SO-2024-5678',
      customer_name: 'Acme Corporation',
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private getMockWorkOrderList(params: { line_id?: string; status?: string; date?: string }) {
    const workOrders: WorkOrder[] = [
      {
        work_order_id: 'WO-2024-0001',
        order_number: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        quantity_ordered: 1000,
        quantity_completed: 892,
        quantity_remaining: 108,
        status: 'in_progress',
        priority: 'high',
        line_id: 'LINE-001',
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        actual_start: new Date().toISOString(),
        actual_end: null,
        customer_order: 'SO-2024-5678',
        customer_name: 'Acme Corporation',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        work_order_id: 'WO-2024-0002',
        order_number: 'WO-2024-0002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        quantity_ordered: 500,
        quantity_completed: 624,
        quantity_remaining: 0,
        status: 'completed',
        priority: 'normal',
        line_id: 'LINE-002',
        scheduled_start: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        scheduled_end: new Date().toISOString(),
        actual_start: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        actual_end: new Date().toISOString(),
        customer_order: 'SO-2024-5679',
        customer_name: 'Beta Industries',
        due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        work_order_id: 'WO-2024-0003',
        order_number: 'WO-2024-0003',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        quantity_ordered: 250,
        quantity_completed: 0,
        quantity_remaining: 250,
        status: 'released',
        priority: 'urgent',
        line_id: 'LINE-001',
        scheduled_start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        scheduled_end: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        actual_start: null,
        actual_end: null,
        customer_order: 'SO-2024-5680',
        customer_name: 'Gamma Tech',
        due_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        work_order_id: 'WO-2024-0004',
        order_number: 'WO-2024-0004',
        product_id: 'PROD-D3456',
        product_name: 'Standard Part D',
        quantity_ordered: 2000,
        quantity_completed: 0,
        quantity_remaining: 2000,
        status: 'on_hold',
        priority: 'low',
        line_id: null,
        scheduled_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scheduled_end: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
        actual_start: null,
        actual_end: null,
        customer_order: null,
        customer_name: null,
        due_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    let filtered = workOrders;
    if (params.line_id) {
      filtered = filtered.filter(wo => wo.line_id === params.line_id);
    }
    if (params.status) {
      filtered = filtered.filter(wo => wo.status === params.status);
    }

    return {
      work_orders: filtered,
      total_count: filtered.length,
      summary: {
        planned: filtered.filter(wo => wo.status === 'planned').length,
        released: filtered.filter(wo => wo.status === 'released').length,
        in_progress: filtered.filter(wo => wo.status === 'in_progress').length,
        completed: filtered.filter(wo => wo.status === 'completed').length,
        on_hold: filtered.filter(wo => wo.status === 'on_hold').length
      }
    };
  }

  private getMockRawMaterials() {
    const materials: RawMaterial[] = [
      {
        material_id: 'MAT-001',
        material_name: 'Steel Sheet 4x8',
        description: '4x8 foot steel sheet, 16 gauge',
        unit_of_measure: 'sheets',
        quantity_on_hand: 245,
        quantity_reserved: 100,
        quantity_available: 145,
        safety_stock: 50,
        reorder_point: 100,
        reorder_quantity: 200,
        location: 'Warehouse A, Rack 1',
        lot_number: 'LOT-2024-0234',
        expiration_date: null,
        unit_cost: 85.50,
        last_receipt_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        last_issue_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        material_id: 'MAT-002',
        material_name: 'Aluminum Rod 1" Dia',
        description: '1 inch diameter aluminum rod, 6061-T6',
        unit_of_measure: 'feet',
        quantity_on_hand: 1250,
        quantity_reserved: 400,
        quantity_available: 850,
        safety_stock: 500,
        reorder_point: 800,
        reorder_quantity: 1000,
        location: 'Warehouse A, Rack 3',
        lot_number: 'LOT-2024-0198',
        expiration_date: null,
        unit_cost: 12.75,
        last_receipt_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        last_issue_date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        material_id: 'MAT-003',
        material_name: 'Electronic Component XR-42',
        description: 'Surface mount resistor array',
        unit_of_measure: 'units',
        quantity_on_hand: 35,
        quantity_reserved: 50,
        quantity_available: -15,
        safety_stock: 100,
        reorder_point: 200,
        reorder_quantity: 500,
        location: 'Warehouse B, Bin 45',
        lot_number: 'LOT-2024-0456',
        expiration_date: null,
        unit_cost: 2.35,
        last_receipt_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_issue_date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      },
      {
        material_id: 'MAT-004',
        material_name: 'Adhesive Compound AC-100',
        description: 'Industrial adhesive, two-part epoxy',
        unit_of_measure: 'gallons',
        quantity_on_hand: 28,
        quantity_reserved: 10,
        quantity_available: 18,
        safety_stock: 20,
        reorder_point: 30,
        reorder_quantity: 50,
        location: 'Chemical Storage, Shelf 2',
        lot_number: 'LOT-2024-0321',
        expiration_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        unit_cost: 125.00,
        last_receipt_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        last_issue_date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      }
    ];

    return {
      materials,
      summary: {
        total_items: materials.length,
        below_safety_stock: materials.filter(m => m.quantity_on_hand < m.safety_stock).length,
        below_reorder_point: materials.filter(m => m.quantity_on_hand < m.reorder_point).length,
        total_inventory_value: materials.reduce((sum, m) => sum + m.quantity_on_hand * m.unit_cost, 0)
      }
    };
  }

  private getMockWIPInventory() {
    const wipItems: WIPInventory[] = [
      {
        wip_id: 'WIP-001',
        work_order_id: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        operation: 'Assembly - Stage 2',
        quantity: 150,
        location: 'LINE-001, Station 3',
        status: 'in_process',
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        estimated_completion: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
      },
      {
        wip_id: 'WIP-002',
        work_order_id: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        operation: 'Quality Inspection',
        quantity: 75,
        location: 'QC Station 1',
        status: 'inspection',
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        estimated_completion: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      },
      {
        wip_id: 'WIP-003',
        work_order_id: 'WO-2024-0002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        operation: 'Machining',
        quantity: 200,
        location: 'LINE-002, CNC Bay',
        status: 'waiting',
        started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        estimated_completion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      },
      {
        wip_id: 'WIP-004',
        work_order_id: 'WO-2024-0005',
        product_id: 'PROD-E7890',
        product_name: 'Custom Part E',
        operation: 'Final Assembly',
        quantity: 25,
        location: 'LINE-001, Station 5',
        status: 'on_hold',
        started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        estimated_completion: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      }
    ];

    return {
      wip_items: wipItems,
      summary: {
        total_items: wipItems.length,
        in_process: wipItems.filter(w => w.status === 'in_process').length,
        waiting: wipItems.filter(w => w.status === 'waiting').length,
        on_hold: wipItems.filter(w => w.status === 'on_hold').length,
        total_value: 45750.00
      }
    };
  }

  private getMockFinishedGoods() {
    const items: FinishedGoods[] = [
      {
        item_id: 'FG-001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        quantity_on_hand: 2500,
        quantity_reserved: 800,
        quantity_available: 1700,
        lot_number: 'LOT-FG-2024-0892',
        production_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        expiration_date: null,
        location: 'Finished Goods Warehouse, Zone A',
        quality_status: 'released',
        unit_cost: 45.00
      },
      {
        item_id: 'FG-002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        quantity_on_hand: 1200,
        quantity_reserved: 500,
        quantity_available: 700,
        lot_number: 'LOT-FG-2024-0891',
        production_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        expiration_date: null,
        location: 'Finished Goods Warehouse, Zone B',
        quality_status: 'released',
        unit_cost: 32.50
      },
      {
        item_id: 'FG-003',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        quantity_on_hand: 150,
        quantity_reserved: 0,
        quantity_available: 150,
        lot_number: 'LOT-FG-2024-0885',
        production_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        expiration_date: null,
        location: 'Finished Goods Warehouse, Zone A',
        quality_status: 'hold',
        unit_cost: 125.00
      }
    ];

    return {
      items,
      summary: {
        total_items: items.length,
        total_quantity: items.reduce((sum, i) => sum + i.quantity_on_hand, 0),
        on_hold: items.filter(i => i.quality_status !== 'released').length,
        total_value: items.reduce((sum, i) => sum + i.quantity_on_hand * i.unit_cost, 0)
      }
    };
  }

  private getMockShortages() {
    const shortages: MaterialShortage[] = [
      {
        material_id: 'MAT-003',
        material_name: 'Electronic Component XR-42',
        quantity_on_hand: 35,
        safety_stock: 100,
        shortage_quantity: 65,
        affected_work_orders: ['WO-2024-0001', 'WO-2024-0003'],
        projected_stockout_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'critical'
      },
      {
        material_id: 'MAT-004',
        material_name: 'Adhesive Compound AC-100',
        quantity_on_hand: 28,
        safety_stock: 20,
        shortage_quantity: 0,
        affected_work_orders: ['WO-2024-0005'],
        projected_stockout_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'medium'
      }
    ];

    return {
      shortages,
      summary: {
        total_shortages: shortages.length,
        critical: shortages.filter(s => s.priority === 'critical').length,
        high: shortages.filter(s => s.priority === 'high').length,
        affected_work_orders: [...new Set(shortages.flatMap(s => s.affected_work_orders))].length
      }
    };
  }

  getConfig(): { baseUrl: string; companyId: string } {
    return {
      baseUrl: this.config.baseUrl,
      companyId: this.config.companyId
    };
  }

  async close(): Promise<void> {
    logger.info('Closing ERP connector');
    this.initialized = false;
  }
}

// Singleton instance
let connector: ERPConnector | null = null;

export function getERPConnector(): ERPConnector {
  if (!connector) {
    const config: ERPConfig = {
      baseUrl: process.env.ERP_BASE_URL || 'http://localhost:8081',
      apiKey: process.env.ERP_API_KEY || '',
      companyId: process.env.ERP_COMPANY_ID || 'COMPANY-001'
    };
    connector = new ERPConnector(config);
  }
  return connector;
}

export function resetERPConnector(): void {
  if (connector) {
    connector.close();
    connector = null;
  }
}

export default ERPConnector;
