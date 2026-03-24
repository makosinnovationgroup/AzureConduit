import { z } from 'zod';
import { getPropertyConnector, WorkOrder } from '../connectors/property';
import { logger } from '../server';

// Schema definitions
export const ListWorkOrdersSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID'),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().describe('Filter by work order status'),
  priority: z.enum(['emergency', 'high', 'medium', 'low']).optional().describe('Filter by priority level'),
});

export const GetWorkOrderSchema = z.object({
  work_order_id: z.string().min(1).describe('The work order ID'),
});

export const GetMaintenanceCostsSchema = z.object({
  property_id: z.string().optional().describe('Filter by property ID'),
  start_date: z.string().optional().describe('Start date for cost period (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date for cost period (YYYY-MM-DD)'),
});

// Types
interface MaintenanceCostReport {
  property_id: string;
  property_name: string;
  total_cost: number;
  work_orders_count: number;
  categories: { category: string; cost: number; count: number }[];
}

// Tool implementations
export async function listWorkOrders(params: z.infer<typeof ListWorkOrdersSchema>): Promise<WorkOrder[]> {
  const connector = getPropertyConnector();
  const { property_id, status, priority } = params;

  logger.info('Listing work orders', { property_id, status, priority });

  const workOrders = await connector.listWorkOrders({ property_id, status, priority });
  logger.info('Retrieved work orders', { count: workOrders.length });

  return workOrders;
}

export async function getWorkOrder(params: z.infer<typeof GetWorkOrderSchema>): Promise<WorkOrder> {
  const connector = getPropertyConnector();
  const { work_order_id } = params;

  logger.info('Getting work order details', { work_order_id });

  const workOrder = await connector.getWorkOrder(work_order_id);
  logger.info('Retrieved work order', {
    work_order_id,
    title: workOrder.title,
    status: workOrder.status,
    priority: workOrder.priority,
  });

  return workOrder;
}

export async function getOpenMaintenance(): Promise<WorkOrder[]> {
  const connector = getPropertyConnector();

  logger.info('Getting open maintenance requests');

  const workOrders = await connector.getOpenMaintenance();
  const emergencyCount = workOrders.filter(w => w.priority === 'emergency').length;
  const highCount = workOrders.filter(w => w.priority === 'high').length;

  logger.info('Retrieved open maintenance', {
    total: workOrders.length,
    emergency: emergencyCount,
    high: highCount,
  });

  return workOrders;
}

export async function getMaintenanceCosts(params: z.infer<typeof GetMaintenanceCostsSchema>): Promise<MaintenanceCostReport[]> {
  const connector = getPropertyConnector();
  const { property_id, start_date, end_date } = params;

  logger.info('Getting maintenance costs', { property_id, start_date, end_date });

  const costs = await connector.getMaintenanceCosts({ property_id, start_date, end_date });
  const totalCost = costs.reduce((sum, c) => sum + c.total_cost, 0);

  logger.info('Retrieved maintenance costs', {
    properties_count: costs.length,
    total_cost: totalCost,
  });

  return costs;
}

// Tool definitions for MCP registration
export const maintenanceTools = [
  {
    name: 'list_work_orders',
    description: 'List maintenance work orders with optional filters for property, status, and priority. Returns work order details including category, assigned technician, and costs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'completed', 'cancelled'],
          description: 'Filter by work order status',
        },
        priority: {
          type: 'string',
          enum: ['emergency', 'high', 'medium', 'low'],
          description: 'Filter by priority level',
        },
      },
    },
    handler: listWorkOrders,
    schema: ListWorkOrdersSchema,
  },
  {
    name: 'get_work_order',
    description: 'Get detailed information about a specific work order including description, assigned technician, estimated and actual costs, and completion status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        work_order_id: {
          type: 'string',
          description: 'The work order ID',
        },
      },
      required: ['work_order_id'],
    },
    handler: getWorkOrder,
    schema: GetWorkOrderSchema,
  },
  {
    name: 'get_open_maintenance',
    description: 'Get all open and in-progress maintenance requests across all properties. Shows emergency and high priority items first.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: getOpenMaintenance,
    schema: z.object({}),
  },
  {
    name: 'get_maintenance_costs',
    description: 'Get maintenance spending report by property. Shows total costs, work order counts, and breakdown by category (plumbing, electrical, HVAC, etc.).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        property_id: {
          type: 'string',
          description: 'Filter by property ID (optional - shows all properties if not specified)',
        },
        start_date: {
          type: 'string',
          description: 'Start date for cost period (YYYY-MM-DD)',
        },
        end_date: {
          type: 'string',
          description: 'End date for cost period (YYYY-MM-DD)',
        },
      },
    },
    handler: getMaintenanceCosts,
    schema: GetMaintenanceCostsSchema,
  },
];
