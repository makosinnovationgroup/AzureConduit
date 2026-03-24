import axios, { AxiosInstance } from 'axios';

/**
 * Inventory Connector
 *
 * Supports multiple inventory/WMS systems:
 * - ERP-based inventory (D365, SAP)
 * - Warehouse Management Systems (WMS)
 * - Generic inventory API
 *
 * Provides unified interface for inventory levels, availability, and alerts.
 */

export type InventorySystemType = 'erp' | 'wms' | 'generic';

export interface InventoryConfig {
  type: InventorySystemType;
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  username?: string;
  password?: string;
  warehouseId?: string; // Default warehouse for queries
}

export interface InventoryLevel {
  productId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseName?: string;
  quantityOnHand: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityOnOrder: number; // Incoming stock
  quantityAllocated: number; // Allocated to orders
  reorderPoint: number;
  reorderQuantity: number;
  unitOfMeasure: string;
  lastUpdated: string;
  location?: string; // Bin/shelf location
}

export interface AvailabilityCheck {
  productId: string;
  sku: string;
  productName: string;
  requestedQuantity: number;
  isAvailable: boolean;
  availableQuantity: number;
  shortfall: number;
  expectedAvailableDate?: string;
  warehouses: WarehouseAvailability[];
}

export interface WarehouseAvailability {
  warehouseId: string;
  warehouseName: string;
  quantityAvailable: number;
  canFulfill: boolean;
}

export interface LowStockAlert {
  productId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseName?: string;
  currentQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  quantityOnOrder: number;
  daysOfSupply?: number;
  severity: 'critical' | 'warning' | 'info';
  lastSaleDate?: string;
  averageDailySales?: number;
}

export interface Product {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  currency?: string;
  weight?: number;
  weightUnit?: string;
  isActive: boolean;
}

class InventoryConnector {
  private config: InventoryConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: InventoryConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(async (requestConfig) => {
      const token = await this.getAccessToken();
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      } else if (this.config.apiKey) {
        requestConfig.headers['X-API-Key'] = this.config.apiKey;
      }
      return requestConfig;
    });
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // For ERP systems with OAuth
    if (this.config.clientId && this.config.clientSecret && this.config.tenantId) {
      try {
        const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
        const response = await axios.post(tokenUrl, new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: `${this.config.baseUrl}/.default`,
        }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        this.accessToken = response.data.access_token;
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
        return this.accessToken;
      } catch (error) {
        console.error('Failed to get access token:', error);
        return null;
      }
    }

    // For basic auth
    if (this.config.username && this.config.password) {
      this.accessToken = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      this.tokenExpiry = new Date(Date.now() + 3600 * 1000);
      return this.accessToken;
    }

    return null;
  }

  /**
   * Check product availability
   */
  async checkAvailability(productId: string, quantity: number): Promise<AvailabilityCheck> {
    try {
      const levels = await this.getInventoryLevels([productId]);
      const productLevels = levels.filter((l) => l.productId === productId || l.sku === productId);

      let totalAvailable = 0;
      const warehouses: WarehouseAvailability[] = [];

      for (const level of productLevels) {
        totalAvailable += level.quantityAvailable;
        warehouses.push({
          warehouseId: level.warehouseId,
          warehouseName: level.warehouseName || level.warehouseId,
          quantityAvailable: level.quantityAvailable,
          canFulfill: level.quantityAvailable >= quantity,
        });
      }

      const productInfo = productLevels[0];
      const isAvailable = totalAvailable >= quantity;
      const shortfall = isAvailable ? 0 : quantity - totalAvailable;

      return {
        productId,
        sku: productInfo?.sku || productId,
        productName: productInfo?.productName || '',
        requestedQuantity: quantity,
        isAvailable,
        availableQuantity: totalAvailable,
        shortfall,
        warehouses,
      };
    } catch (error) {
      console.error('Failed to check availability:', error);
      throw error;
    }
  }

  /**
   * Get inventory levels for products
   */
  async getInventoryLevels(productIds?: string[]): Promise<InventoryLevel[]> {
    try {
      switch (this.config.type) {
        case 'erp':
          return this.getErpInventoryLevels(productIds);
        case 'wms':
          return this.getWmsInventoryLevels(productIds);
        default:
          return this.getGenericInventoryLevels(productIds);
      }
    } catch (error) {
      console.error('Failed to get inventory levels:', error);
      throw error;
    }
  }

  /**
   * Get products with inventory below reorder point
   */
  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    try {
      switch (this.config.type) {
        case 'erp':
          return this.getErpLowStockAlerts();
        case 'wms':
          return this.getWmsLowStockAlerts();
        default:
          return this.getGenericLowStockAlerts();
      }
    } catch (error) {
      console.error('Failed to get low stock alerts:', error);
      throw error;
    }
  }

  /**
   * Get product details
   */
  async getProduct(productId: string): Promise<Product | null> {
    try {
      const endpoint = this.config.type === 'erp'
        ? `/data/ReleasedProducts('${productId}')`
        : `/api/products/${productId}`;

      const response = await this.client.get(endpoint);
      return this.mapToProduct(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ERP-specific methods (D365 pattern)
  private async getErpInventoryLevels(productIds?: string[]): Promise<InventoryLevel[]> {
    let filter = '';
    if (productIds && productIds.length > 0) {
      const itemFilter = productIds.map((id) => `ItemNumber eq '${id}'`).join(' or ');
      filter = `$filter=${itemFilter}`;
    }

    if (this.config.warehouseId) {
      const warehouseFilter = `InventoryWarehouseId eq '${this.config.warehouseId}'`;
      filter = filter
        ? `${filter} and ${warehouseFilter}`
        : `$filter=${warehouseFilter}`;
    }

    const endpoint = `/data/InventOnhandEntities${filter ? '?' + filter : ''}`;
    const response = await this.client.get(endpoint);

    return this.mapErpInventoryLevels(response.data.value || []);
  }

  private mapErpInventoryLevels(data: Record<string, unknown>[]): InventoryLevel[] {
    return data.map((item) => ({
      productId: item.ItemNumber as string || '',
      sku: item.ItemNumber as string || '',
      productName: item.ProductName as string || '',
      warehouseId: item.InventoryWarehouseId as string || '',
      warehouseName: item.WarehouseName as string,
      quantityOnHand: item.PhysicalOnhandQuantity as number || 0,
      quantityAvailable: item.AvailablePhysicalQuantity as number || 0,
      quantityReserved: item.ReservedQuantity as number || 0,
      quantityOnOrder: item.OrderedQuantity as number || 0,
      quantityAllocated: item.AllocatedQuantity as number || 0,
      reorderPoint: item.ReorderPoint as number || 0,
      reorderQuantity: item.StandardOrderQuantity as number || 0,
      unitOfMeasure: item.InventoryUnitSymbol as string || 'EA',
      lastUpdated: item.ModifiedDateTime as string || new Date().toISOString(),
      location: item.WMSLocationId as string,
    }));
  }

  private async getErpLowStockAlerts(): Promise<LowStockAlert[]> {
    // Query items where available quantity is at or below reorder point
    const endpoint = `/data/InventOnhandEntities?$filter=AvailablePhysicalQuantity le ReorderPoint and ReorderPoint gt 0`;
    const response = await this.client.get(endpoint);

    return this.mapErpLowStockAlerts(response.data.value || []);
  }

  private mapErpLowStockAlerts(data: Record<string, unknown>[]): LowStockAlert[] {
    return data.map((item) => {
      const current = item.AvailablePhysicalQuantity as number || 0;
      const reorderPoint = item.ReorderPoint as number || 0;
      const ratio = reorderPoint > 0 ? current / reorderPoint : 1;

      let severity: 'critical' | 'warning' | 'info';
      if (ratio <= 0.25 || current === 0) {
        severity = 'critical';
      } else if (ratio <= 0.5) {
        severity = 'warning';
      } else {
        severity = 'info';
      }

      return {
        productId: item.ItemNumber as string || '',
        sku: item.ItemNumber as string || '',
        productName: item.ProductName as string || '',
        warehouseId: item.InventoryWarehouseId as string || '',
        warehouseName: item.WarehouseName as string,
        currentQuantity: current,
        reorderPoint,
        reorderQuantity: item.StandardOrderQuantity as number || 0,
        quantityOnOrder: item.OrderedQuantity as number || 0,
        severity,
      };
    });
  }

  // WMS-specific methods
  private async getWmsInventoryLevels(productIds?: string[]): Promise<InventoryLevel[]> {
    let endpoint = '/api/inventory';
    const params: Record<string, string> = {};

    if (productIds && productIds.length > 0) {
      params['sku'] = productIds.join(',');
    }

    if (this.config.warehouseId) {
      params['warehouse'] = this.config.warehouseId;
    }

    const response = await this.client.get(endpoint, { params });
    return this.mapWmsInventoryLevels(response.data.inventory || response.data || []);
  }

  private mapWmsInventoryLevels(data: Record<string, unknown>[]): InventoryLevel[] {
    return data.map((item) => ({
      productId: (item.product_id || item.productId || item.item_id) as string || '',
      sku: (item.sku || item.item_number) as string || '',
      productName: (item.product_name || item.productName || item.name) as string || '',
      warehouseId: (item.warehouse_id || item.warehouseId || item.facility) as string || '',
      warehouseName: (item.warehouse_name || item.warehouseName) as string,
      quantityOnHand: (item.quantity_on_hand || item.quantityOnHand || item.qty_on_hand) as number || 0,
      quantityAvailable: (item.quantity_available || item.quantityAvailable || item.qty_available) as number || 0,
      quantityReserved: (item.quantity_reserved || item.quantityReserved || item.qty_reserved) as number || 0,
      quantityOnOrder: (item.quantity_on_order || item.quantityOnOrder || item.incoming) as number || 0,
      quantityAllocated: (item.quantity_allocated || item.quantityAllocated || item.allocated) as number || 0,
      reorderPoint: (item.reorder_point || item.reorderPoint || item.min_qty) as number || 0,
      reorderQuantity: (item.reorder_quantity || item.reorderQuantity || item.order_qty) as number || 0,
      unitOfMeasure: (item.unit_of_measure || item.uom || 'EA') as string,
      lastUpdated: (item.last_updated || item.lastUpdated || item.updated_at) as string || new Date().toISOString(),
      location: (item.location || item.bin || item.slot) as string,
    }));
  }

  private async getWmsLowStockAlerts(): Promise<LowStockAlert[]> {
    const endpoint = '/api/inventory/low-stock';
    const params: Record<string, string> = {};

    if (this.config.warehouseId) {
      params['warehouse'] = this.config.warehouseId;
    }

    const response = await this.client.get(endpoint, { params });
    return this.mapWmsLowStockAlerts(response.data.alerts || response.data || []);
  }

  private mapWmsLowStockAlerts(data: Record<string, unknown>[]): LowStockAlert[] {
    return data.map((item) => ({
      productId: (item.product_id || item.productId || item.item_id) as string || '',
      sku: (item.sku || item.item_number) as string || '',
      productName: (item.product_name || item.productName || item.name) as string || '',
      warehouseId: (item.warehouse_id || item.warehouseId || item.facility) as string || '',
      warehouseName: (item.warehouse_name || item.warehouseName) as string,
      currentQuantity: (item.current_quantity || item.currentQuantity || item.qty_available) as number || 0,
      reorderPoint: (item.reorder_point || item.reorderPoint || item.min_qty) as number || 0,
      reorderQuantity: (item.reorder_quantity || item.reorderQuantity || item.order_qty) as number || 0,
      quantityOnOrder: (item.quantity_on_order || item.quantityOnOrder || item.incoming) as number || 0,
      daysOfSupply: (item.days_of_supply || item.daysOfSupply) as number,
      severity: (item.severity || item.alert_level || 'warning') as 'critical' | 'warning' | 'info',
      lastSaleDate: (item.last_sale_date || item.lastSaleDate) as string,
      averageDailySales: (item.average_daily_sales || item.averageDailySales) as number,
    }));
  }

  // Generic inventory methods
  private async getGenericInventoryLevels(productIds?: string[]): Promise<InventoryLevel[]> {
    let endpoint = '/api/inventory';
    const params: Record<string, string> = {};

    if (productIds && productIds.length > 0) {
      params['product_ids'] = productIds.join(',');
    }

    if (this.config.warehouseId) {
      params['warehouse_id'] = this.config.warehouseId;
    }

    const response = await this.client.get(endpoint, { params });
    return this.mapGenericInventoryLevels(response.data.inventory || response.data || []);
  }

  private mapGenericInventoryLevels(data: Record<string, unknown>[]): InventoryLevel[] {
    return data.map((item) => ({
      productId: (item.product_id || item.productId || item.id) as string || '',
      sku: (item.sku || item.product_code) as string || '',
      productName: (item.product_name || item.productName || item.name) as string || '',
      warehouseId: (item.warehouse_id || item.warehouseId || item.location_id) as string || '',
      warehouseName: (item.warehouse_name || item.warehouseName || item.location_name) as string,
      quantityOnHand: (item.on_hand || item.quantity || item.qty) as number || 0,
      quantityAvailable: (item.available || item.qty_available) as number || 0,
      quantityReserved: (item.reserved || item.qty_reserved) as number || 0,
      quantityOnOrder: (item.on_order || item.incoming) as number || 0,
      quantityAllocated: (item.allocated || item.committed) as number || 0,
      reorderPoint: (item.reorder_point || item.min_level) as number || 0,
      reorderQuantity: (item.reorder_qty || item.order_quantity) as number || 0,
      unitOfMeasure: (item.uom || item.unit || 'EA') as string,
      lastUpdated: (item.updated_at || item.last_updated) as string || new Date().toISOString(),
      location: (item.bin || item.shelf || item.location) as string,
    }));
  }

  private async getGenericLowStockAlerts(): Promise<LowStockAlert[]> {
    const endpoint = '/api/inventory/alerts';
    const params: Record<string, string> = { type: 'low_stock' };

    if (this.config.warehouseId) {
      params['warehouse_id'] = this.config.warehouseId;
    }

    const response = await this.client.get(endpoint, { params });
    return this.mapGenericLowStockAlerts(response.data.alerts || response.data || []);
  }

  private mapGenericLowStockAlerts(data: Record<string, unknown>[]): LowStockAlert[] {
    return data.map((item) => ({
      productId: (item.product_id || item.productId || item.id) as string || '',
      sku: (item.sku || item.product_code) as string || '',
      productName: (item.product_name || item.productName || item.name) as string || '',
      warehouseId: (item.warehouse_id || item.warehouseId || item.location_id) as string || '',
      warehouseName: (item.warehouse_name || item.warehouseName || item.location_name) as string,
      currentQuantity: (item.current_qty || item.available || item.quantity) as number || 0,
      reorderPoint: (item.reorder_point || item.min_level) as number || 0,
      reorderQuantity: (item.reorder_qty || item.order_quantity) as number || 0,
      quantityOnOrder: (item.on_order || item.incoming) as number || 0,
      daysOfSupply: (item.days_supply || item.coverage_days) as number,
      severity: (item.severity || item.priority || 'warning') as 'critical' | 'warning' | 'info',
      lastSaleDate: (item.last_sale || item.last_sold) as string,
      averageDailySales: (item.avg_daily_sales || item.daily_demand) as number,
    }));
  }

  private mapToProduct(data: Record<string, unknown>): Product {
    if (this.config.type === 'erp') {
      return {
        productId: data.ItemNumber as string || '',
        sku: data.ItemNumber as string || '',
        name: data.ProductName as string || '',
        description: data.ProductDescription as string,
        category: data.ItemGroup as string,
        unitPrice: data.SalesPrice as number,
        currency: data.SalesCurrencyCode as string,
        weight: data.NetWeight as number,
        weightUnit: data.NetWeightUnit as string,
        isActive: (data.ItemState as string) === 'Active',
      };
    }

    return {
      productId: (data.product_id || data.productId || data.id) as string || '',
      sku: (data.sku || data.product_code) as string || '',
      name: (data.name || data.product_name) as string || '',
      description: (data.description || data.product_description) as string,
      category: (data.category || data.product_category) as string,
      unitPrice: (data.price || data.unit_price) as number,
      currency: (data.currency || 'USD') as string,
      weight: data.weight as number,
      weightUnit: (data.weight_unit || 'lbs') as string,
      isActive: data.active !== false && data.is_active !== false,
    };
  }
}

// Singleton instance
let inventoryConnector: InventoryConnector | null = null;

export function initializeInventoryConnector(config: InventoryConfig): InventoryConnector {
  inventoryConnector = new InventoryConnector(config);
  return inventoryConnector;
}

export function getInventoryConnector(): InventoryConnector {
  if (!inventoryConnector) {
    throw new Error('Inventory connector not initialized. Call initializeInventoryConnector first.');
  }
  return inventoryConnector;
}

export function createInventoryConnectorFromEnv(): InventoryConnector {
  const config: InventoryConfig = {
    type: (process.env.INVENTORY_SYSTEM_TYPE as InventorySystemType) || 'generic',
    baseUrl: process.env.INVENTORY_BASE_URL || process.env.ERP_BASE_URL || 'http://localhost:3000',
    apiKey: process.env.INVENTORY_API_KEY,
    clientId: process.env.INVENTORY_CLIENT_ID || process.env.ERP_CLIENT_ID,
    clientSecret: process.env.INVENTORY_CLIENT_SECRET || process.env.ERP_CLIENT_SECRET,
    tenantId: process.env.INVENTORY_TENANT_ID || process.env.ERP_TENANT_ID,
    username: process.env.INVENTORY_USERNAME,
    password: process.env.INVENTORY_PASSWORD,
    warehouseId: process.env.DEFAULT_WAREHOUSE_ID,
  };
  return initializeInventoryConnector(config);
}

export default InventoryConnector;
