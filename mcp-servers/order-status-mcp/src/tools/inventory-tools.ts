import { z } from 'zod';
import {
  getInventoryConnector,
  AvailabilityCheck,
  InventoryLevel,
  LowStockAlert,
} from '../connectors/inventory';

/**
 * Inventory Tools
 *
 * Provides inventory information from ERP or WMS systems:
 * - Product availability checking
 * - Current inventory levels
 * - Low stock alerts
 */

// Schema definitions
export const CheckAvailabilitySchema = z.object({
  product_id: z.string().min(1).describe('The product ID or SKU to check'),
  quantity: z.number().min(1).describe('The quantity needed'),
  warehouse_id: z.string().optional().describe('Specific warehouse to check (optional, checks all if not specified)'),
});

export const GetInventoryLevelsSchema = z.object({
  product_ids: z.array(z.string()).optional().describe('List of product IDs or SKUs to check (optional, returns all if not specified)'),
  warehouse_id: z.string().optional().describe('Filter by warehouse ID'),
  include_zero_stock: z.boolean().optional().default(false).describe('Include items with zero stock'),
});

export const GetLowStockAlertsSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info', 'all']).optional().default('all').describe('Filter by alert severity'),
  warehouse_id: z.string().optional().describe('Filter by warehouse ID'),
  limit: z.number().min(1).max(100).optional().default(50).describe('Maximum number of alerts to return'),
});

// Response types
export interface AvailabilityResponse {
  availability: AvailabilityCheck;
  recommendation: string;
  alternativeProducts?: string[];
}

export interface InventoryLevelsResponse {
  levels: InventoryLevel[];
  totalProducts: number;
  totalQuantityOnHand: number;
  totalQuantityAvailable: number;
  warehouseSummary: WarehouseSummary[];
}

export interface WarehouseSummary {
  warehouseId: string;
  warehouseName?: string;
  productCount: number;
  totalOnHand: number;
  totalAvailable: number;
}

export interface LowStockAlertsResponse {
  alerts: LowStockAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

// Tool implementations
export async function checkAvailability(
  params: z.infer<typeof CheckAvailabilitySchema>
): Promise<AvailabilityResponse> {
  const inventoryConnector = getInventoryConnector();

  const availability = await inventoryConnector.checkAvailability(
    params.product_id,
    params.quantity
  );

  // Generate recommendation based on availability
  let recommendation: string;

  if (availability.isAvailable) {
    if (availability.warehouses.length === 1) {
      recommendation = `Available from ${availability.warehouses[0].warehouseName || availability.warehouses[0].warehouseId}`;
    } else {
      const fulfillingWarehouses = availability.warehouses.filter((w) => w.canFulfill);
      if (fulfillingWarehouses.length > 0) {
        recommendation = `Can be fulfilled from ${fulfillingWarehouses.length} warehouse(s)`;
      } else {
        recommendation = 'Available through multi-warehouse fulfillment';
      }
    }
  } else {
    if (availability.availableQuantity > 0) {
      recommendation = `Partial availability: ${availability.availableQuantity} of ${params.quantity} requested. Shortfall: ${availability.shortfall}`;
    } else {
      recommendation = `Out of stock. Consider backordering or checking alternative products.`;
    }

    // Add expected availability date if known
    if (availability.expectedAvailableDate) {
      recommendation += ` Expected available: ${availability.expectedAvailableDate}`;
    }
  }

  return {
    availability,
    recommendation,
  };
}

export async function getInventoryLevels(
  params: z.infer<typeof GetInventoryLevelsSchema>
): Promise<InventoryLevelsResponse> {
  const inventoryConnector = getInventoryConnector();

  let levels = await inventoryConnector.getInventoryLevels(params.product_ids);

  // Filter out zero stock if not included
  if (!params.include_zero_stock) {
    levels = levels.filter((l) => l.quantityOnHand > 0 || l.quantityAvailable > 0);
  }

  // Filter by warehouse if specified
  if (params.warehouse_id) {
    levels = levels.filter((l) => l.warehouseId === params.warehouse_id);
  }

  // Calculate totals
  let totalQuantityOnHand = 0;
  let totalQuantityAvailable = 0;

  // Build warehouse summary
  const warehouseMap = new Map<string, WarehouseSummary>();

  for (const level of levels) {
    totalQuantityOnHand += level.quantityOnHand;
    totalQuantityAvailable += level.quantityAvailable;

    // Update warehouse summary
    const existing = warehouseMap.get(level.warehouseId);
    if (existing) {
      existing.productCount += 1;
      existing.totalOnHand += level.quantityOnHand;
      existing.totalAvailable += level.quantityAvailable;
    } else {
      warehouseMap.set(level.warehouseId, {
        warehouseId: level.warehouseId,
        warehouseName: level.warehouseName,
        productCount: 1,
        totalOnHand: level.quantityOnHand,
        totalAvailable: level.quantityAvailable,
      });
    }
  }

  return {
    levels,
    totalProducts: levels.length,
    totalQuantityOnHand,
    totalQuantityAvailable,
    warehouseSummary: Array.from(warehouseMap.values()),
  };
}

export async function getLowStockAlerts(
  params: z.infer<typeof GetLowStockAlertsSchema>
): Promise<LowStockAlertsResponse> {
  const inventoryConnector = getInventoryConnector();

  let alerts = await inventoryConnector.getLowStockAlerts();

  // Filter by severity
  if (params.severity && params.severity !== 'all') {
    alerts = alerts.filter((a) => a.severity === params.severity);
  }

  // Filter by warehouse
  if (params.warehouse_id) {
    alerts = alerts.filter((a) => a.warehouseId === params.warehouse_id);
  }

  // Apply limit
  if (alerts.length > params.limit) {
    alerts = alerts.slice(0, params.limit);
  }

  // Calculate summary
  const summary = {
    critical: 0,
    warning: 0,
    info: 0,
    total: alerts.length,
  };

  for (const alert of alerts) {
    summary[alert.severity] += 1;
  }

  return {
    alerts,
    summary,
  };
}

// Tool definitions for MCP registration
export const inventoryTools = [
  {
    name: 'check_availability',
    description: 'Check if a specific quantity of a product is available in stock. Returns availability across warehouses with fulfillment recommendations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID or SKU to check',
        },
        quantity: {
          type: 'number',
          description: 'The quantity needed',
        },
        warehouse_id: {
          type: 'string',
          description: 'Specific warehouse to check (optional)',
        },
      },
      required: ['product_id', 'quantity'],
    },
    handler: checkAvailability,
    schema: CheckAvailabilitySchema,
  },
  {
    name: 'get_inventory_levels',
    description: 'Get current inventory levels for products. Returns quantities on hand, available, reserved, and on order.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of product IDs or SKUs to check (optional, returns all if not specified)',
        },
        warehouse_id: {
          type: 'string',
          description: 'Filter by warehouse ID',
        },
        include_zero_stock: {
          type: 'boolean',
          description: 'Include items with zero stock (default: false)',
        },
      },
    },
    handler: getInventoryLevels,
    schema: GetInventoryLevelsSchema,
  },
  {
    name: 'get_low_stock_alerts',
    description: 'Get products that are below their reorder point. Useful for inventory planning and preventing stockouts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'info', 'all'],
          description: 'Filter by alert severity (default: all)',
        },
        warehouse_id: {
          type: 'string',
          description: 'Filter by warehouse ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of alerts to return (1-100, default 50)',
        },
      },
    },
    handler: getLowStockAlerts,
    schema: GetLowStockAlertsSchema,
  },
];
