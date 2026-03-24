import { z } from 'zod';
import { getErpConnector, Order, DateRange } from '../connectors/erp';
import { getShippingConnector, Shipment } from '../connectors/shipping';
import { getInventoryConnector } from '../connectors/inventory';

/**
 * Order Tools
 *
 * Provides unified order status information by combining data from:
 * - ERP system (order details, line items, customer info)
 * - Shipping carriers (tracking, delivery status)
 * - Inventory system (product availability)
 */

// Schema definitions
export const GetOrderStatusSchema = z.object({
  order_id: z.string().min(1).describe('The order ID or order number to look up'),
});

export const SearchOrdersSchema = z.object({
  customer: z.string().optional().describe('Customer ID or name to filter by'),
  date_range: z.object({
    start_date: z.string().describe('Start date in YYYY-MM-DD format'),
    end_date: z.string().describe('End date in YYYY-MM-DD format'),
  }).optional().describe('Date range for order creation'),
  status: z.enum([
    'pending', 'confirmed', 'processing', 'partially_shipped',
    'shipped', 'delivered', 'cancelled', 'on_hold'
  ]).optional().describe('Order status to filter by'),
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of orders to return'),
});

export const GetRecentOrdersSchema = z.object({
  customer_id: z.string().min(1).describe('The customer ID'),
  limit: z.number().min(1).max(50).optional().default(10).describe('Maximum number of orders to return'),
});

export const GetDelayedOrdersSchema = z.object({
  days_overdue: z.number().min(1).optional().default(1).describe('Minimum days past promised delivery date'),
});

// Response types
export interface OrderStatusResponse {
  order: Order;
  shipments: Shipment[];
  deliveryEta?: string;
  isDelayed: boolean;
  delayReason?: string;
  fulfillmentPercentage: number;
}

export interface OrderSearchResult {
  orders: Order[];
  totalCount: number;
  hasMore: boolean;
}

export interface DelayedOrderInfo {
  order: Order;
  daysOverdue: number;
  promisedDate: string;
  currentStatus: string;
  shipments: Shipment[];
  reason?: string;
}

// Tool implementations
export async function getOrderStatus(
  params: z.infer<typeof GetOrderStatusSchema>
): Promise<OrderStatusResponse | null> {
  const erpConnector = getErpConnector();
  const shippingConnector = getShippingConnector();

  // Get order from ERP
  const order = await erpConnector.getOrder(params.order_id);
  if (!order) {
    return null;
  }

  // Get shipments for the order
  const shipments = await shippingConnector.getShipmentsForOrder(order.orderId);

  // Get delivery ETA
  let deliveryEta: string | undefined;
  if (shipments.length > 0) {
    // Find the latest estimated delivery date across all shipments
    for (const shipment of shipments) {
      if (shipment.estimatedDeliveryDate) {
        if (!deliveryEta || shipment.estimatedDeliveryDate > deliveryEta) {
          deliveryEta = shipment.estimatedDeliveryDate;
        }
      }
    }
  }

  // Calculate fulfillment percentage
  let totalQuantity = 0;
  let shippedQuantity = 0;
  for (const line of order.lineItems) {
    totalQuantity += line.quantity;
    shippedQuantity += line.quantityShipped;
  }
  const fulfillmentPercentage = totalQuantity > 0
    ? Math.round((shippedQuantity / totalQuantity) * 100)
    : 0;

  // Check if order is delayed
  const today = new Date().toISOString().split('T')[0];
  const promisedDate = order.promisedDeliveryDate || order.requestedDeliveryDate;
  const isDelayed = promisedDate
    ? promisedDate < today && order.status !== 'delivered' && order.status !== 'cancelled'
    : false;

  let delayReason: string | undefined;
  if (isDelayed) {
    if (fulfillmentPercentage === 0) {
      delayReason = 'Order has not shipped yet';
    } else if (fulfillmentPercentage < 100) {
      delayReason = 'Order is partially shipped';
    } else {
      // Check shipment status for delays
      const inTransitShipments = shipments.filter(
        (s) => s.status !== 'delivered' && s.status !== 'cancelled'
      );
      if (inTransitShipments.length > 0) {
        const hasException = inTransitShipments.some((s) => s.status === 'exception');
        delayReason = hasException
          ? 'Shipping exception reported'
          : 'Shipment still in transit past promised date';
      }
    }
  }

  return {
    order,
    shipments,
    deliveryEta,
    isDelayed,
    delayReason,
    fulfillmentPercentage,
  };
}

export async function searchOrders(
  params: z.infer<typeof SearchOrdersSchema>
): Promise<OrderSearchResult> {
  const erpConnector = getErpConnector();

  const dateRange: DateRange | undefined = params.date_range
    ? {
        startDate: params.date_range.start_date,
        endDate: params.date_range.end_date,
      }
    : undefined;

  const orders = await erpConnector.searchOrders({
    customerId: params.customer,
    dateRange,
    status: params.status,
    limit: params.limit,
  });

  return {
    orders,
    totalCount: orders.length,
    hasMore: orders.length === params.limit,
  };
}

export async function getRecentOrders(
  params: z.infer<typeof GetRecentOrdersSchema>
): Promise<Order[]> {
  const erpConnector = getErpConnector();
  return erpConnector.getRecentOrders(params.customer_id, params.limit);
}

export async function getDelayedOrders(
  params: z.infer<typeof GetDelayedOrdersSchema>
): Promise<DelayedOrderInfo[]> {
  const erpConnector = getErpConnector();
  const shippingConnector = getShippingConnector();

  // Get orders that are past their promised delivery date
  const delayedOrders = await erpConnector.getDelayedOrders();

  const today = new Date();
  const results: DelayedOrderInfo[] = [];

  for (const order of delayedOrders) {
    const promisedDate = order.promisedDeliveryDate || order.requestedDeliveryDate;
    if (!promisedDate) continue;

    const promisedDateTime = new Date(promisedDate);
    const daysOverdue = Math.floor(
      (today.getTime() - promisedDateTime.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Filter by minimum days overdue
    if (daysOverdue < params.days_overdue) continue;

    // Get shipments for context
    const shipments = await shippingConnector.getShipmentsForOrder(order.orderId);

    // Determine reason for delay
    let reason: string | undefined;
    const shippedCount = shipments.filter((s) => s.status !== 'label_created').length;
    const totalLines = order.lineItems.length;

    if (shippedCount === 0) {
      reason = 'Order has not shipped';
    } else if (shippedCount < totalLines) {
      reason = 'Order partially shipped';
    } else {
      const hasException = shipments.some((s) => s.status === 'exception');
      if (hasException) {
        reason = 'Shipping exception';
      } else {
        reason = 'In transit - delayed';
      }
    }

    results.push({
      order,
      daysOverdue,
      promisedDate,
      currentStatus: order.status,
      shipments,
      reason,
    });
  }

  // Sort by days overdue (most overdue first)
  results.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return results;
}

// Tool definitions for MCP registration
export const orderTools = [
  {
    name: 'get_order_status',
    description: 'Get complete order status including order details, line items, shipping status, tracking information, and estimated delivery. Combines data from ERP, shipping carriers, and inventory systems.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID or order number to look up',
        },
      },
      required: ['order_id'],
    },
    handler: getOrderStatus,
    schema: GetOrderStatusSchema,
  },
  {
    name: 'search_orders',
    description: 'Search for orders with optional filters for customer, date range, and status. Returns matching orders with basic details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customer: {
          type: 'string',
          description: 'Customer ID or name to filter by',
        },
        date_range: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            end_date: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
          },
          required: ['start_date', 'end_date'],
          description: 'Date range for order creation',
        },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled', 'on_hold'],
          description: 'Order status to filter by',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return (1-100, default 20)',
        },
      },
    },
    handler: searchOrders,
    schema: SearchOrdersSchema,
  },
  {
    name: 'get_recent_orders',
    description: 'Get the most recent orders for a specific customer. Useful for customer service to quickly see order history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'The customer ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return (1-50, default 10)',
        },
      },
      required: ['customer_id'],
    },
    handler: getRecentOrders,
    schema: GetRecentOrdersSchema,
  },
  {
    name: 'get_delayed_orders',
    description: 'Get all orders that are behind schedule (past their promised delivery date but not yet delivered). Includes delay reason and shipping details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days_overdue: {
          type: 'number',
          description: 'Minimum days past promised delivery date (default 1)',
        },
      },
    },
    handler: getDelayedOrders,
    schema: GetDelayedOrdersSchema,
  },
];
