import { z } from 'zod';
import { getMESConnector } from '../connectors/mes';
import { getERPConnector } from '../connectors/erp';
import logger from '../utils/logger';

// Schema definitions
export const getProductionStatusSchema = z.object({});

export const getWorkOrderStatusSchema = z.object({
  work_order_id: z.string().min(1).describe('The unique identifier of the work order')
});

export const listWorkOrdersSchema = z.object({
  line: z.string().optional().describe('Filter by production line ID'),
  status: z.enum(['planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional().describe('Filter by work order status'),
  date: z.string().optional().describe('Filter by scheduled date (YYYY-MM-DD format)')
});

export const getProductionScheduleSchema = z.object({
  period: z.enum(['today', 'week']).default('today').describe('Time period for the schedule'),
  line_id: z.string().optional().describe('Filter by specific production line')
});

export const getLineEfficiencySchema = z.object({
  line_id: z.string().min(1).describe('The production line ID to get efficiency metrics for')
});

// Tool handlers
export async function getProductionStatus() {
  logger.info('Getting production status');

  const mesConnector = getMESConnector();
  const result = await mesConnector.getProductionStatus();

  logger.info('Production status retrieved', {
    total_lines: result.summary.total_lines,
    running: result.summary.running
  });

  return {
    plant_id: result.plant_id,
    timestamp: result.timestamp,
    lines: result.lines.map(line => ({
      line_id: line.line_id,
      name: line.name,
      status: line.status,
      current_product: line.current_product,
      current_work_order: line.current_work_order,
      shift: line.shift,
      operator_count: line.operator_count,
      production_rate: {
        target: line.target_rate,
        actual: line.actual_rate,
        units: 'units/hour'
      },
      daily_progress: {
        produced: line.units_produced,
        target: line.units_target,
        efficiency_percent: line.efficiency_percent
      },
      last_updated: line.last_updated
    })),
    summary: result.summary
  };
}

export async function getWorkOrderStatus(params: z.infer<typeof getWorkOrderStatusSchema>) {
  const { work_order_id } = params;
  logger.info('Getting work order status', { work_order_id });

  const erpConnector = getERPConnector();
  const workOrder = await erpConnector.getWorkOrderStatus(work_order_id);

  logger.info('Work order status retrieved', {
    work_order_id,
    status: workOrder.status
  });

  return {
    work_order: {
      id: workOrder.work_order_id,
      order_number: workOrder.order_number,
      product: {
        id: workOrder.product_id,
        name: workOrder.product_name
      },
      quantities: {
        ordered: workOrder.quantity_ordered,
        completed: workOrder.quantity_completed,
        remaining: workOrder.quantity_remaining,
        completion_percent: Math.round((workOrder.quantity_completed / workOrder.quantity_ordered) * 100)
      },
      status: workOrder.status,
      priority: workOrder.priority,
      line_id: workOrder.line_id,
      schedule: {
        planned_start: workOrder.scheduled_start,
        planned_end: workOrder.scheduled_end,
        actual_start: workOrder.actual_start,
        actual_end: workOrder.actual_end
      },
      customer: workOrder.customer_name ? {
        order_number: workOrder.customer_order,
        name: workOrder.customer_name
      } : null,
      due_date: workOrder.due_date,
      timestamps: {
        created: workOrder.created_at,
        updated: workOrder.updated_at
      }
    }
  };
}

export async function listWorkOrders(params: z.infer<typeof listWorkOrdersSchema>) {
  logger.info('Listing work orders', params);

  const erpConnector = getERPConnector();
  const result = await erpConnector.listWorkOrders({
    line_id: params.line,
    status: params.status,
    date: params.date
  });

  logger.info('Work orders listed', {
    total_count: result.total_count,
    filters: params
  });

  return {
    work_orders: result.work_orders.map(wo => ({
      id: wo.work_order_id,
      order_number: wo.order_number,
      product_name: wo.product_name,
      quantity_ordered: wo.quantity_ordered,
      quantity_completed: wo.quantity_completed,
      status: wo.status,
      priority: wo.priority,
      line_id: wo.line_id,
      scheduled_start: wo.scheduled_start,
      scheduled_end: wo.scheduled_end,
      due_date: wo.due_date,
      customer_name: wo.customer_name
    })),
    total_count: result.total_count,
    summary: result.summary
  };
}

export async function getProductionSchedule(params: z.infer<typeof getProductionScheduleSchema>) {
  logger.info('Getting production schedule', params);

  const mesConnector = getMESConnector();
  const result = await mesConnector.getProductionSchedule({
    period: params.period,
    line_id: params.line_id
  });

  logger.info('Production schedule retrieved', {
    period: params.period,
    total_orders: result.summary.total_orders
  });

  return {
    period: result.period,
    schedule: result.schedule.map(item => ({
      schedule_id: item.schedule_id,
      work_order_id: item.work_order_id,
      line_id: item.line_id,
      product: {
        id: item.product_id,
        name: item.product_name
      },
      quantity: item.quantity,
      timing: {
        scheduled_start: item.scheduled_start,
        scheduled_end: item.scheduled_end,
        actual_start: item.actual_start
      },
      status: item.status,
      priority: item.priority
    })),
    summary: result.summary
  };
}

export async function getLineEfficiency(params: z.infer<typeof getLineEfficiencySchema>) {
  const { line_id } = params;
  logger.info('Getting line efficiency', { line_id });

  const mesConnector = getMESConnector();
  const oee = await mesConnector.getLineEfficiency(line_id);

  logger.info('Line efficiency retrieved', {
    line_id,
    oee: oee.oee
  });

  return {
    line: {
      id: oee.line_id,
      name: oee.line_name
    },
    period: oee.period,
    oee_metrics: {
      overall_oee: oee.oee,
      availability: oee.availability,
      performance: oee.performance,
      quality: oee.quality
    },
    production_time: {
      planned_minutes: oee.planned_production_time,
      actual_run_minutes: oee.actual_run_time,
      downtime_minutes: oee.downtime_minutes
    },
    output: {
      total_units: oee.total_units,
      good_units: oee.good_units,
      rejected_units: oee.rejected_units,
      yield_percent: oee.total_units > 0 ? Math.round((oee.good_units / oee.total_units) * 100 * 10) / 10 : 0
    },
    ideal_cycle_time: oee.ideal_cycle_time
  };
}

// Tool definitions for MCP registration
export const productionToolDefinitions = [
  {
    name: 'get_production_status',
    description: 'Get the current production status across all production lines including running status, current work orders, production rates, and efficiency metrics. Useful for supervisors and managers to get a real-time overview of the manufacturing floor.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_work_order_status',
    description: 'Get detailed status of a specific work order including quantities ordered/completed, schedule, customer information, and progress. Use this to track individual work order progress.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        work_order_id: {
          type: 'string',
          description: 'The unique identifier of the work order (e.g., WO-2024-0001)'
        }
      },
      required: ['work_order_id']
    }
  },
  {
    name: 'list_work_orders',
    description: 'List work orders with optional filtering by production line, status, or date. Returns a summary of all matching work orders with their key information.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        line: {
          type: 'string',
          description: 'Filter by production line ID (e.g., LINE-001)'
        },
        status: {
          type: 'string',
          enum: ['planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled'],
          description: 'Filter by work order status'
        },
        date: {
          type: 'string',
          description: 'Filter by scheduled date in YYYY-MM-DD format'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_production_schedule',
    description: 'Get the production schedule for today or the current week. Shows all scheduled work orders with their timing, status, and priority. Essential for production planners.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week'],
          description: 'Time period for the schedule (default: today)',
          default: 'today'
        },
        line_id: {
          type: 'string',
          description: 'Filter schedule by specific production line'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_line_efficiency',
    description: 'Get Overall Equipment Effectiveness (OEE) and efficiency metrics for a specific production line. Returns availability, performance, quality metrics, and production output statistics.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        line_id: {
          type: 'string',
          description: 'The production line ID to get efficiency metrics for (e.g., LINE-001)'
        }
      },
      required: ['line_id']
    }
  }
];
