import { z } from 'zod';
import { getShippingConnector, Shipment, DeliveryEstimate } from '../connectors/shipping';

/**
 * Shipping Tools
 *
 * Provides shipping and tracking information from carriers:
 * - ShipStation (multi-carrier)
 * - FedEx
 * - UPS
 * - Generic shipping APIs
 */

// Schema definitions
export const GetTrackingSchema = z.object({
  tracking_number: z.string().min(1).describe('The tracking number to look up'),
});

export const GetShipmentsInTransitSchema = z.object({
  carrier: z.string().optional().describe('Filter by carrier (e.g., fedex, ups, usps)'),
  limit: z.number().min(1).max(100).optional().default(50).describe('Maximum number of shipments to return'),
});

export const GetDeliveryEtaSchema = z.object({
  order_id: z.string().min(1).describe('The order ID to get delivery estimate for'),
  tracking_number: z.string().optional().describe('Optional tracking number for more accurate estimate'),
});

// Response types
export interface TrackingResponse {
  shipment: Shipment;
  currentLocation?: string;
  lastUpdate?: string;
  isDelivered: boolean;
  hasException: boolean;
  exceptionDetails?: string;
}

export interface ShipmentsInTransitResponse {
  shipments: Shipment[];
  totalCount: number;
  byCarrier: Record<string, number>;
  byStatus: Record<string, number>;
}

// Tool implementations
export async function getTracking(
  params: z.infer<typeof GetTrackingSchema>
): Promise<TrackingResponse | null> {
  const shippingConnector = getShippingConnector();

  const shipment = await shippingConnector.getTracking(params.tracking_number);
  if (!shipment) {
    return null;
  }

  // Get current location from most recent event
  let currentLocation: string | undefined;
  let lastUpdate: string | undefined;

  if (shipment.events && shipment.events.length > 0) {
    const latestEvent = shipment.events[0]; // Events are typically newest first
    lastUpdate = latestEvent.timestamp;

    const locationParts: string[] = [];
    if (latestEvent.city) locationParts.push(latestEvent.city);
    if (latestEvent.state) locationParts.push(latestEvent.state);
    if (latestEvent.country && latestEvent.country !== 'US') {
      locationParts.push(latestEvent.country);
    }
    if (locationParts.length > 0) {
      currentLocation = locationParts.join(', ');
    } else if (latestEvent.location) {
      currentLocation = latestEvent.location;
    }
  }

  // Check for exceptions
  const hasException = shipment.status === 'exception';
  let exceptionDetails: string | undefined;

  if (hasException && shipment.events && shipment.events.length > 0) {
    // Find the exception event
    const exceptionEvent = shipment.events.find(
      (e) => e.status.toLowerCase().includes('exception') ||
             e.description.toLowerCase().includes('exception') ||
             e.description.toLowerCase().includes('delay')
    );
    if (exceptionEvent) {
      exceptionDetails = exceptionEvent.description;
    }
  }

  return {
    shipment,
    currentLocation,
    lastUpdate,
    isDelivered: shipment.status === 'delivered',
    hasException,
    exceptionDetails,
  };
}

export async function getShipmentsInTransit(
  params: z.infer<typeof GetShipmentsInTransitSchema>
): Promise<ShipmentsInTransitResponse> {
  const shippingConnector = getShippingConnector();

  let shipments = await shippingConnector.getShipmentsInTransit();

  // Filter by carrier if specified
  if (params.carrier) {
    const carrierLower = params.carrier.toLowerCase();
    shipments = shipments.filter(
      (s) => s.carrier.toLowerCase().includes(carrierLower) ||
             s.carrierCode?.toLowerCase().includes(carrierLower)
    );
  }

  // Apply limit
  if (params.limit && shipments.length > params.limit) {
    shipments = shipments.slice(0, params.limit);
  }

  // Calculate statistics
  const byCarrier: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const shipment of shipments) {
    // Count by carrier
    const carrier = shipment.carrier || 'Unknown';
    byCarrier[carrier] = (byCarrier[carrier] || 0) + 1;

    // Count by status
    byStatus[shipment.status] = (byStatus[shipment.status] || 0) + 1;
  }

  return {
    shipments,
    totalCount: shipments.length,
    byCarrier,
    byStatus,
  };
}

export async function getDeliveryEta(
  params: z.infer<typeof GetDeliveryEtaSchema>
): Promise<DeliveryEstimate | null> {
  const shippingConnector = getShippingConnector();

  const estimate = await shippingConnector.getDeliveryEta(
    params.order_id,
    params.tracking_number
  );

  return estimate;
}

// Tool definitions for MCP registration
export const shippingTools = [
  {
    name: 'get_tracking',
    description: 'Get detailed tracking information for a shipment including current location, all tracking events, and delivery status. Works with FedEx, UPS, USPS, and other carriers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tracking_number: {
          type: 'string',
          description: 'The tracking number to look up',
        },
      },
      required: ['tracking_number'],
    },
    handler: getTracking,
    schema: GetTrackingSchema,
  },
  {
    name: 'get_shipments_in_transit',
    description: 'Get all shipments that are currently in transit (shipped but not yet delivered). Useful for logistics monitoring and proactive customer communication.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        carrier: {
          type: 'string',
          description: 'Filter by carrier (e.g., fedex, ups, usps)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of shipments to return (1-100, default 50)',
        },
      },
    },
    handler: getShipmentsInTransit,
    schema: GetShipmentsInTransitSchema,
  },
  {
    name: 'get_delivery_eta',
    description: 'Get the estimated delivery date/time for an order. Uses carrier tracking data for accurate estimates when available.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        order_id: {
          type: 'string',
          description: 'The order ID to get delivery estimate for',
        },
        tracking_number: {
          type: 'string',
          description: 'Optional tracking number for more accurate estimate',
        },
      },
      required: ['order_id'],
    },
    handler: getDeliveryEta,
    schema: GetDeliveryEtaSchema,
  },
];
