import axios, { AxiosInstance } from 'axios';

/**
 * Shipping Connector
 *
 * Supports multiple shipping carrier APIs:
 * - ShipStation (multi-carrier aggregator)
 * - FedEx
 * - UPS
 * - Generic shipping API
 *
 * Provides unified interface for tracking shipments and delivery estimates.
 */

export type ShippingCarrier = 'shipstation' | 'fedex' | 'ups' | 'generic';

export interface ShippingConfig {
  carrier: ShippingCarrier;
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accountNumber?: string;
  // FedEx specific
  fedexClientId?: string;
  fedexClientSecret?: string;
  // UPS specific
  upsClientId?: string;
  upsClientSecret?: string;
  upsAccountNumber?: string;
}

export interface Shipment {
  shipmentId: string;
  orderId: string;
  orderNumber?: string;
  carrier: string;
  carrierCode?: string;
  service: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  statusDescription: string;
  shipDate: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: Dimensions;
  origin: ShipmentAddress;
  destination: ShipmentAddress;
  events: TrackingEvent[];
  cost?: ShippingCost;
}

export type ShipmentStatus =
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned'
  | 'cancelled';

export interface TrackingEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface ShipmentAddress {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: string;
}

export interface ShippingCost {
  amount: number;
  currency: string;
}

export interface DeliveryEstimate {
  orderId: string;
  trackingNumber?: string;
  estimatedDeliveryDate: string;
  estimatedDeliveryTime?: string;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

class ShippingConnector {
  private config: ShippingConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: ShippingConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: this.getBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(async (requestConfig) => {
      const authHeaders = await this.getAuthHeaders();
      Object.assign(requestConfig.headers, authHeaders);
      return requestConfig;
    });
  }

  private getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }

    switch (this.config.carrier) {
      case 'shipstation':
        return 'https://ssapi.shipstation.com';
      case 'fedex':
        return 'https://apis.fedex.com';
      case 'ups':
        return 'https://onlinetools.ups.com/api';
      default:
        return 'http://localhost:3000';
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    switch (this.config.carrier) {
      case 'shipstation':
        // ShipStation uses Basic Auth with API key:secret
        if (this.config.apiKey && this.config.apiSecret) {
          const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
          return { Authorization: `Basic ${auth}` };
        }
        break;

      case 'fedex':
        const fedexToken = await this.getFedExToken();
        if (fedexToken) {
          return { Authorization: `Bearer ${fedexToken}` };
        }
        break;

      case 'ups':
        const upsToken = await this.getUpsToken();
        if (upsToken) {
          return { Authorization: `Bearer ${upsToken}` };
        }
        break;

      default:
        if (this.config.apiKey) {
          return { 'X-API-Key': this.config.apiKey };
        }
    }

    return {};
  }

  private async getFedExToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config.fedexClientId || !this.config.fedexClientSecret) {
      console.warn('FedEx credentials not configured');
      return null;
    }

    try {
      const response = await axios.post(
        'https://apis.fedex.com/oauth/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.fedexClientId,
          client_secret: this.config.fedexClientSecret,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get FedEx token:', error);
      return null;
    }
  }

  private async getUpsToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config.upsClientId || !this.config.upsClientSecret) {
      console.warn('UPS credentials not configured');
      return null;
    }

    try {
      const auth = Buffer.from(`${this.config.upsClientId}:${this.config.upsClientSecret}`).toString('base64');
      const response = await axios.post(
        'https://onlinetools.ups.com/security/v1/oauth/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get UPS token:', error);
      return null;
    }
  }

  /**
   * Get tracking details by tracking number
   */
  async getTracking(trackingNumber: string): Promise<Shipment | null> {
    try {
      switch (this.config.carrier) {
        case 'shipstation':
          return this.getShipStationTracking(trackingNumber);
        case 'fedex':
          return this.getFedExTracking(trackingNumber);
        case 'ups':
          return this.getUpsTracking(trackingNumber);
        default:
          return this.getGenericTracking(trackingNumber);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get shipments for an order
   */
  async getShipmentsForOrder(orderId: string): Promise<Shipment[]> {
    try {
      switch (this.config.carrier) {
        case 'shipstation':
          const response = await this.client.get('/shipments', {
            params: { orderNumber: orderId },
          });
          return this.mapShipStationShipments(response.data.shipments || []);
        default:
          const genericResponse = await this.client.get(`/api/orders/${orderId}/shipments`);
          return this.mapGenericShipments(genericResponse.data.shipments || genericResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to get shipments for order:', error);
      return [];
    }
  }

  /**
   * Get all shipments currently in transit
   */
  async getShipmentsInTransit(): Promise<Shipment[]> {
    try {
      switch (this.config.carrier) {
        case 'shipstation':
          const response = await this.client.get('/shipments', {
            params: {
              shipmentStatus: 'shipped',
              sortBy: 'ShipDate',
              sortDir: 'DESC',
              pageSize: 100,
            },
          });
          const shipments = this.mapShipStationShipments(response.data.shipments || []);
          // Filter to only in-transit (not delivered)
          return shipments.filter((s) => s.status !== 'delivered');
        default:
          const genericResponse = await this.client.get('/api/shipments', {
            params: { status: 'in_transit' },
          });
          return this.mapGenericShipments(genericResponse.data.shipments || genericResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to get shipments in transit:', error);
      return [];
    }
  }

  /**
   * Get estimated delivery date for an order
   */
  async getDeliveryEta(orderId: string, trackingNumber?: string): Promise<DeliveryEstimate | null> {
    try {
      // If we have a tracking number, get real-time estimate from carrier
      if (trackingNumber) {
        const shipment = await this.getTracking(trackingNumber);
        if (shipment && shipment.estimatedDeliveryDate) {
          return {
            orderId,
            trackingNumber,
            estimatedDeliveryDate: shipment.estimatedDeliveryDate,
            confidence: 'high',
          };
        }
      }

      // Otherwise, get shipments for the order and find the latest ETA
      const shipments = await this.getShipmentsForOrder(orderId);
      if (shipments.length === 0) {
        return null;
      }

      // Find the shipment with the latest estimated delivery
      let latestEta: string | null = null;
      let latestTrackingNumber: string | null = null;

      for (const shipment of shipments) {
        if (shipment.estimatedDeliveryDate) {
          if (!latestEta || shipment.estimatedDeliveryDate > latestEta) {
            latestEta = shipment.estimatedDeliveryDate;
            latestTrackingNumber = shipment.trackingNumber;
          }
        }
      }

      if (latestEta) {
        return {
          orderId,
          trackingNumber: latestTrackingNumber || undefined,
          estimatedDeliveryDate: latestEta,
          confidence: 'medium',
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get delivery ETA:', error);
      return null;
    }
  }

  // ShipStation specific methods
  private async getShipStationTracking(trackingNumber: string): Promise<Shipment | null> {
    const response = await this.client.get('/shipments', {
      params: { trackingNumber },
    });

    const shipments = response.data.shipments || [];
    if (shipments.length === 0) {
      return null;
    }

    return this.mapShipStationShipment(shipments[0]);
  }

  private mapShipStationShipments(data: Record<string, unknown>[]): Shipment[] {
    return data.map((item) => this.mapShipStationShipment(item));
  }

  private mapShipStationShipment(data: Record<string, unknown>): Shipment {
    const shipTo = (data.shipTo as Record<string, unknown>) || {};

    return {
      shipmentId: (data.shipmentId as number)?.toString() || '',
      orderId: (data.orderId as number)?.toString() || '',
      orderNumber: data.orderNumber as string,
      carrier: data.carrierCode as string || '',
      carrierCode: data.carrierCode as string,
      service: data.serviceCode as string || '',
      trackingNumber: data.trackingNumber as string || '',
      trackingUrl: this.buildTrackingUrl(data.carrierCode as string, data.trackingNumber as string),
      status: this.mapShipStationStatus(data.shipmentStatus as string),
      statusDescription: data.shipmentStatus as string || '',
      shipDate: data.shipDate as string || '',
      estimatedDeliveryDate: data.estimatedDeliveryDate as string,
      actualDeliveryDate: data.actualDeliveryDate as string,
      weight: data.weight as number,
      weightUnit: 'lbs',
      origin: {
        street1: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      },
      destination: {
        name: shipTo.name as string,
        company: shipTo.company as string,
        street1: shipTo.street1 as string || '',
        street2: shipTo.street2 as string,
        city: shipTo.city as string || '',
        state: shipTo.state as string || '',
        postalCode: shipTo.postalCode as string || '',
        country: shipTo.country as string || 'US',
      },
      events: [], // ShipStation doesn't return events in shipment list
      cost: data.shipmentCost
        ? { amount: data.shipmentCost as number, currency: 'USD' }
        : undefined,
    };
  }

  private mapShipStationStatus(status: string): ShipmentStatus {
    const statusMap: Record<string, ShipmentStatus> = {
      'label_created': 'label_created',
      'shipped': 'in_transit',
      'delivered': 'delivered',
      'returned': 'returned',
      'cancelled': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'in_transit';
  }

  // FedEx specific methods
  private async getFedExTracking(trackingNumber: string): Promise<Shipment | null> {
    const response = await this.client.post('/track/v1/trackingnumbers', {
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber,
          },
        },
      ],
      includeDetailedScans: true,
    });

    const trackResults = response.data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!trackResults) {
      return null;
    }

    return this.mapFedExTracking(trackResults, trackingNumber);
  }

  private mapFedExTracking(data: Record<string, unknown>, trackingNumber: string): Shipment {
    const latestStatus = (data.latestStatusDetail as Record<string, unknown>) || {};
    const deliveryDetails = (data.deliveryDetails as Record<string, unknown>) || {};
    const shipperAddress = ((data.shipperInformation as Record<string, unknown>)?.address as Record<string, unknown>) || {};
    const recipientAddress = ((data.recipientInformation as Record<string, unknown>)?.address as Record<string, unknown>) || {};
    const scanEvents = (data.scanEvents as Record<string, unknown>[]) || [];

    return {
      shipmentId: trackingNumber,
      orderId: '',
      carrier: 'FedEx',
      carrierCode: 'fedex',
      service: (data.serviceType as string) || '',
      trackingNumber,
      trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      status: this.mapFedExStatus(latestStatus.code as string),
      statusDescription: latestStatus.description as string || '',
      shipDate: (data.shipDateBegin as string) || '',
      estimatedDeliveryDate: (deliveryDetails.estimatedDeliveryTimestamp as string)?.split('T')[0],
      actualDeliveryDate: (deliveryDetails.actualDeliveryTimestamp as string)?.split('T')[0],
      origin: {
        street1: shipperAddress.streetLines?.[0] as string || '',
        city: shipperAddress.city as string || '',
        state: shipperAddress.stateOrProvinceCode as string || '',
        postalCode: shipperAddress.postalCode as string || '',
        country: shipperAddress.countryCode as string || 'US',
      },
      destination: {
        street1: recipientAddress.streetLines?.[0] as string || '',
        city: recipientAddress.city as string || '',
        state: recipientAddress.stateOrProvinceCode as string || '',
        postalCode: recipientAddress.postalCode as string || '',
        country: recipientAddress.countryCode as string || 'US',
      },
      events: scanEvents.map((event) => this.mapFedExEvent(event)),
    };
  }

  private mapFedExStatus(code: string): ShipmentStatus {
    const statusMap: Record<string, ShipmentStatus> = {
      'OC': 'label_created',
      'PU': 'picked_up',
      'IT': 'in_transit',
      'OD': 'out_for_delivery',
      'DL': 'delivered',
      'DE': 'exception',
      'RS': 'returned',
    };
    return statusMap[code] || 'in_transit';
  }

  private mapFedExEvent(data: Record<string, unknown>): TrackingEvent {
    const address = (data.scanLocation as Record<string, unknown>) || {};
    return {
      timestamp: data.date as string || '',
      status: data.eventType as string || '',
      description: data.eventDescription as string || '',
      city: address.city as string,
      state: address.stateOrProvinceCode as string,
      country: address.countryCode as string,
      postalCode: address.postalCode as string,
    };
  }

  // UPS specific methods
  private async getUpsTracking(trackingNumber: string): Promise<Shipment | null> {
    const response = await this.client.get(`/track/v1/details/${trackingNumber}`, {
      params: {
        locale: 'en_US',
        returnSignature: 'false',
      },
    });

    const trackResponse = response.data.trackResponse?.shipment?.[0]?.package?.[0];
    if (!trackResponse) {
      return null;
    }

    return this.mapUpsTracking(trackResponse, trackingNumber);
  }

  private mapUpsTracking(data: Record<string, unknown>, trackingNumber: string): Shipment {
    const currentStatus = (data.currentStatus as Record<string, unknown>) || {};
    const deliveryDate = (data.deliveryDate as Record<string, unknown>[]) || [];
    const activities = (data.activity as Record<string, unknown>[]) || [];

    return {
      shipmentId: trackingNumber,
      orderId: '',
      carrier: 'UPS',
      carrierCode: 'ups',
      service: (data.service as Record<string, unknown>)?.description as string || '',
      trackingNumber,
      trackingUrl: `https://www.ups.com/track?tracknum=${trackingNumber}`,
      status: this.mapUpsStatus(currentStatus.code as string),
      statusDescription: currentStatus.description as string || '',
      shipDate: '',
      estimatedDeliveryDate: deliveryDate[0]?.date as string,
      actualDeliveryDate: currentStatus.code === 'D' ? activities[0]?.date as string : undefined,
      origin: {
        street1: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      },
      destination: {
        street1: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      },
      events: activities.map((activity) => this.mapUpsEvent(activity)),
    };
  }

  private mapUpsStatus(code: string): ShipmentStatus {
    const statusMap: Record<string, ShipmentStatus> = {
      'M': 'label_created',
      'P': 'picked_up',
      'I': 'in_transit',
      'O': 'out_for_delivery',
      'D': 'delivered',
      'X': 'exception',
      'RS': 'returned',
    };
    return statusMap[code] || 'in_transit';
  }

  private mapUpsEvent(data: Record<string, unknown>): TrackingEvent {
    const location = (data.location as Record<string, unknown>)?.address as Record<string, unknown> || {};
    const status = (data.status as Record<string, unknown>) || {};

    return {
      timestamp: `${data.date}T${data.time}`,
      status: status.code as string || '',
      description: status.description as string || '',
      city: location.city as string,
      state: location.stateProvince as string,
      country: location.country as string,
      postalCode: location.postalCode as string,
    };
  }

  // Generic tracking
  private async getGenericTracking(trackingNumber: string): Promise<Shipment | null> {
    const response = await this.client.get(`/api/tracking/${trackingNumber}`);
    return this.mapGenericShipment(response.data);
  }

  private mapGenericShipments(data: Record<string, unknown>[]): Shipment[] {
    return data.map((item) => this.mapGenericShipment(item));
  }

  private mapGenericShipment(data: Record<string, unknown>): Shipment {
    const origin = (data.origin as Record<string, unknown>) || {};
    const destination = (data.destination as Record<string, unknown>) || {};
    const events = (data.events as Record<string, unknown>[]) || [];

    return {
      shipmentId: (data.shipment_id || data.shipmentId || data.id) as string || '',
      orderId: (data.order_id || data.orderId) as string || '',
      orderNumber: (data.order_number || data.orderNumber) as string,
      carrier: (data.carrier || data.carrier_name) as string || '',
      carrierCode: (data.carrier_code || data.carrierCode) as string,
      service: (data.service || data.service_type) as string || '',
      trackingNumber: (data.tracking_number || data.trackingNumber) as string || '',
      trackingUrl: (data.tracking_url || data.trackingUrl) as string,
      status: (data.status as ShipmentStatus) || 'in_transit',
      statusDescription: (data.status_description || data.statusDescription) as string || '',
      shipDate: (data.ship_date || data.shipDate) as string || '',
      estimatedDeliveryDate: (data.estimated_delivery_date || data.estimatedDeliveryDate || data.eta) as string,
      actualDeliveryDate: (data.actual_delivery_date || data.actualDeliveryDate || data.delivered_at) as string,
      weight: (data.weight || data.package_weight) as number,
      weightUnit: (data.weight_unit || 'lbs') as string,
      origin: {
        street1: (origin.street1 || origin.address1 || '') as string,
        street2: (origin.street2 || origin.address2) as string,
        city: (origin.city || '') as string,
        state: (origin.state || origin.province || '') as string,
        postalCode: (origin.postal_code || origin.postalCode || origin.zip || '') as string,
        country: (origin.country || 'US') as string,
      },
      destination: {
        street1: (destination.street1 || destination.address1 || '') as string,
        street2: (destination.street2 || destination.address2) as string,
        city: (destination.city || '') as string,
        state: (destination.state || destination.province || '') as string,
        postalCode: (destination.postal_code || destination.postalCode || destination.zip || '') as string,
        country: (destination.country || 'US') as string,
      },
      events: events.map((event) => ({
        timestamp: (event.timestamp || event.date || event.time) as string || '',
        status: (event.status || event.code) as string || '',
        description: (event.description || event.message) as string || '',
        location: event.location as string,
        city: event.city as string,
        state: event.state as string,
        country: event.country as string,
        postalCode: (event.postal_code || event.postalCode) as string,
      })),
      cost: data.cost
        ? { amount: (data.cost as Record<string, unknown>).amount as number, currency: ((data.cost as Record<string, unknown>).currency || 'USD') as string }
        : undefined,
    };
  }

  private buildTrackingUrl(carrierCode: string, trackingNumber: string): string {
    if (!trackingNumber) return '';

    const urlMap: Record<string, string> = {
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'dhl': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    };

    return urlMap[carrierCode?.toLowerCase()] || '';
  }
}

// Singleton instance
let shippingConnector: ShippingConnector | null = null;

export function initializeShippingConnector(config: ShippingConfig): ShippingConnector {
  shippingConnector = new ShippingConnector(config);
  return shippingConnector;
}

export function getShippingConnector(): ShippingConnector {
  if (!shippingConnector) {
    throw new Error('Shipping connector not initialized. Call initializeShippingConnector first.');
  }
  return shippingConnector;
}

export function createShippingConnectorFromEnv(): ShippingConnector {
  const config: ShippingConfig = {
    carrier: (process.env.SHIPPING_CARRIER as ShippingCarrier) || 'generic',
    baseUrl: process.env.SHIPPING_BASE_URL,
    apiKey: process.env.SHIPPING_API_KEY,
    apiSecret: process.env.SHIPPING_API_SECRET,
    accountNumber: process.env.SHIPPING_ACCOUNT_NUMBER,
    // FedEx
    fedexClientId: process.env.FEDEX_CLIENT_ID,
    fedexClientSecret: process.env.FEDEX_CLIENT_SECRET,
    // UPS
    upsClientId: process.env.UPS_CLIENT_ID,
    upsClientSecret: process.env.UPS_CLIENT_SECRET,
    upsAccountNumber: process.env.UPS_ACCOUNT_NUMBER,
  };
  return initializeShippingConnector(config);
}

export default ShippingConnector;
