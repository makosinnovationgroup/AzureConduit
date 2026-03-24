import { z } from 'zod';
import { getERPConnector } from '../connectors/erp';
import logger from '../utils/logger';

// Schema definitions
export const getRawMaterialLevelsSchema = z.object({});

export const getWIPInventorySchema = z.object({});

export const getFinishedGoodsSchema = z.object({});

export const getMaterialShortagesSchema = z.object({});

// Tool handlers
export async function getRawMaterialLevels() {
  logger.info('Getting raw material levels');

  const erpConnector = getERPConnector();
  const result = await erpConnector.getRawMaterialLevels();

  logger.info('Raw material levels retrieved', {
    total_items: result.summary.total_items,
    below_safety_stock: result.summary.below_safety_stock
  });

  return {
    materials: result.materials.map(material => ({
      material_id: material.material_id,
      name: material.material_name,
      description: material.description,
      unit_of_measure: material.unit_of_measure,
      inventory: {
        on_hand: material.quantity_on_hand,
        reserved: material.quantity_reserved,
        available: material.quantity_available
      },
      reorder_info: {
        safety_stock: material.safety_stock,
        reorder_point: material.reorder_point,
        reorder_quantity: material.reorder_quantity,
        below_safety_stock: material.quantity_on_hand < material.safety_stock,
        below_reorder_point: material.quantity_on_hand < material.reorder_point
      },
      location: material.location,
      lot_number: material.lot_number,
      expiration_date: material.expiration_date,
      unit_cost: material.unit_cost,
      inventory_value: material.quantity_on_hand * material.unit_cost,
      last_receipt_date: material.last_receipt_date,
      last_issue_date: material.last_issue_date
    })),
    summary: {
      total_items: result.summary.total_items,
      items_below_safety_stock: result.summary.below_safety_stock,
      items_below_reorder_point: result.summary.below_reorder_point,
      total_inventory_value: result.summary.total_inventory_value
    }
  };
}

export async function getWIPInventory() {
  logger.info('Getting WIP inventory');

  const erpConnector = getERPConnector();
  const result = await erpConnector.getWIPInventory();

  logger.info('WIP inventory retrieved', {
    total_items: result.summary.total_items,
    in_process: result.summary.in_process
  });

  return {
    wip_items: result.wip_items.map(item => ({
      wip_id: item.wip_id,
      work_order_id: item.work_order_id,
      product: {
        id: item.product_id,
        name: item.product_name
      },
      current_operation: item.operation,
      quantity: item.quantity,
      location: item.location,
      status: item.status,
      timing: {
        started_at: item.started_at,
        estimated_completion: item.estimated_completion
      }
    })),
    summary: {
      total_items: result.summary.total_items,
      by_status: {
        in_process: result.summary.in_process,
        waiting: result.summary.waiting,
        on_hold: result.summary.on_hold
      },
      estimated_total_value: result.summary.total_value
    }
  };
}

export async function getFinishedGoods() {
  logger.info('Getting finished goods inventory');

  const erpConnector = getERPConnector();
  const result = await erpConnector.getFinishedGoods();

  logger.info('Finished goods inventory retrieved', {
    total_items: result.summary.total_items,
    total_quantity: result.summary.total_quantity
  });

  return {
    finished_goods: result.items.map(item => ({
      item_id: item.item_id,
      product: {
        id: item.product_id,
        name: item.product_name
      },
      inventory: {
        on_hand: item.quantity_on_hand,
        reserved: item.quantity_reserved,
        available: item.quantity_available
      },
      lot_number: item.lot_number,
      production_date: item.production_date,
      expiration_date: item.expiration_date,
      location: item.location,
      quality_status: item.quality_status,
      unit_cost: item.unit_cost,
      inventory_value: item.quantity_on_hand * item.unit_cost
    })),
    summary: {
      total_items: result.summary.total_items,
      total_quantity_on_hand: result.summary.total_quantity,
      items_on_hold: result.summary.on_hold,
      total_inventory_value: result.summary.total_value
    }
  };
}

export async function getMaterialShortages() {
  logger.info('Getting material shortages');

  const erpConnector = getERPConnector();
  const result = await erpConnector.getMaterialShortages();

  logger.info('Material shortages retrieved', {
    total_shortages: result.summary.total_shortages,
    critical: result.summary.critical
  });

  return {
    shortages: result.shortages.map(shortage => ({
      material_id: shortage.material_id,
      material_name: shortage.material_name,
      current_quantity: shortage.quantity_on_hand,
      safety_stock: shortage.safety_stock,
      shortage_quantity: shortage.shortage_quantity,
      affected_work_orders: shortage.affected_work_orders,
      affected_work_order_count: shortage.affected_work_orders.length,
      projected_stockout_date: shortage.projected_stockout_date,
      priority: shortage.priority,
      days_until_stockout: Math.ceil(
        (new Date(shortage.projected_stockout_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    })),
    summary: {
      total_shortages: result.summary.total_shortages,
      by_priority: {
        critical: result.summary.critical,
        high: result.summary.high
      },
      total_affected_work_orders: result.summary.affected_work_orders
    },
    recommendations: result.shortages
      .filter(s => s.priority === 'critical' || s.priority === 'high')
      .map(s => ({
        material: s.material_name,
        action: s.priority === 'critical'
          ? 'URGENT: Expedite purchase order or find alternative supplier immediately'
          : 'Schedule rush order to prevent production delays',
        priority: s.priority
      }))
  };
}

// Tool definitions for MCP registration
export const inventoryToolDefinitions = [
  {
    name: 'get_raw_material_levels',
    description: 'Get current raw material inventory levels including quantities on hand, reserved, and available. Also shows items below safety stock or reorder point that may need attention. Essential for inventory planners and purchasing.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_wip_inventory',
    description: 'Get Work-In-Progress (WIP) inventory showing all items currently in the production process. Includes current operation, location, status, and estimated completion times. Useful for tracking production flow and identifying bottlenecks.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_finished_goods',
    description: 'Get finished goods inventory showing completed products available for shipment. Includes quantity on hand, reserved for orders, quality status, and lot information. Important for shipping and order fulfillment teams.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_material_shortages',
    description: 'Get a list of materials that are below safety stock levels or at risk of stockout. Shows affected work orders, projected stockout dates, and priority levels. Critical for production planners and purchasing to prevent production delays.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  }
];
