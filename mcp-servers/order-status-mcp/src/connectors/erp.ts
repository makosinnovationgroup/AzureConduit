import axios, { AxiosInstance } from 'axios';

/**
 * ERP Connector
 *
 * Supports multiple ERP systems:
 * - Microsoft Dynamics 365 Supply Chain Management (D365 SCM)
 * - SAP S/4HANA
 * - Generic REST-based ERP
 *
 * The connector abstracts the underlying ERP system and provides
 * a unified interface for order and customer data.
 */

export type ErpType = 'd365' | 'sap' | 'generic';

export interface ErpConfig {
  type: ErpType;
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string; // For D365 OAuth
  username?: string;
  password?: string;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  requestedDeliveryDate: string;
  promisedDeliveryDate?: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  lineItems: OrderLineItem[];
  shippingAddress: Address;
  billingAddress: Address;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'partially_shipped'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'on_hold';

export interface OrderLineItem {
  lineId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: LineItemStatus;
  quantityShipped: number;
  quantityRemaining: number;
}

export type LineItemStatus =
  | 'pending'
  | 'allocated'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'backordered'
  | 'cancelled';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  customerId: string;
  customerNumber: string;
  name: string;
  email: string;
  phone?: string;
  billingAddress: Address;
  shippingAddresses: Address[];
  creditLimit?: number;
  paymentTerms?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

class ErpConnector {
  private config: ErpConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: ErpConfig) {
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
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Get new token based on ERP type
    switch (this.config.type) {
      case 'd365':
        return this.getD365Token();
      case 'sap':
        return this.getSapToken();
      default:
        return null;
    }
  }

  private async getD365Token(): Promise<string | null> {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.tenantId) {
      console.warn('D365 OAuth credentials not configured');
      return null;
    }

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
      console.error('Failed to get D365 access token:', error);
      return null;
    }
  }

  private async getSapToken(): Promise<string | null> {
    if (!this.config.username || !this.config.password) {
      console.warn('SAP credentials not configured');
      return null;
    }

    try {
      // SAP typically uses Basic Auth or OAuth2 depending on configuration
      const authString = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      // For SAP, we might use Basic Auth directly in headers instead of OAuth token
      this.accessToken = authString;
      this.tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get SAP access token:', error);
      return null;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const endpoint = this.getOrderEndpoint(orderId);
      const response = await this.client.get(endpoint);
      return this.mapToOrder(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search orders with filters
   */
  async searchOrders(params: {
    customerId?: string;
    dateRange?: DateRange;
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    const endpoint = this.getOrdersEndpoint();
    const queryParams = this.buildSearchParams(params);

    const response = await this.client.get(endpoint, { params: queryParams });
    return this.mapToOrders(response.data);
  }

  /**
   * Get recent orders for a customer
   */
  async getRecentOrders(customerId: string, limit: number = 10): Promise<Order[]> {
    return this.searchOrders({
      customerId,
      limit,
    });
  }

  /**
   * Get orders that are behind schedule
   */
  async getDelayedOrders(): Promise<Order[]> {
    const today = new Date().toISOString().split('T')[0];

    // Get orders that are past their promised delivery date but not delivered
    const endpoint = this.getOrdersEndpoint();
    const response = await this.client.get(endpoint, {
      params: this.buildDelayedOrdersParams(today),
    });

    return this.mapToOrders(response.data);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const endpoint = this.getCustomerEndpoint(customerId);
      const response = await this.client.get(endpoint);
      return this.mapToCustomer(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Endpoint helpers based on ERP type
  private getOrderEndpoint(orderId: string): string {
    switch (this.config.type) {
      case 'd365':
        return `/data/SalesOrderHeaders('${orderId}')?$expand=SalesOrderLines`;
      case 'sap':
        return `/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('${orderId}')?$expand=to_Item`;
      default:
        return `/api/orders/${orderId}`;
    }
  }

  private getOrdersEndpoint(): string {
    switch (this.config.type) {
      case 'd365':
        return '/data/SalesOrderHeaders?$expand=SalesOrderLines';
      case 'sap':
        return '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$expand=to_Item';
      default:
        return '/api/orders';
    }
  }

  private getCustomerEndpoint(customerId: string): string {
    switch (this.config.type) {
      case 'd365':
        return `/data/CustomersV3('${customerId}')`;
      case 'sap':
        return `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer('${customerId}')`;
      default:
        return `/api/customers/${customerId}`;
    }
  }

  private buildSearchParams(params: {
    customerId?: string;
    dateRange?: DateRange;
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }): Record<string, string> {
    const queryParams: Record<string, string> = {};

    switch (this.config.type) {
      case 'd365':
        const filters: string[] = [];
        if (params.customerId) {
          filters.push(`CustomerAccount eq '${params.customerId}'`);
        }
        if (params.dateRange) {
          filters.push(`OrderCreatedDateTime ge ${params.dateRange.startDate}T00:00:00Z`);
          filters.push(`OrderCreatedDateTime le ${params.dateRange.endDate}T23:59:59Z`);
        }
        if (params.status) {
          filters.push(`SalesOrderStatus eq '${this.mapStatusToD365(params.status)}'`);
        }
        if (filters.length > 0) {
          queryParams['$filter'] = filters.join(' and ');
        }
        if (params.limit) {
          queryParams['$top'] = params.limit.toString();
        }
        if (params.offset) {
          queryParams['$skip'] = params.offset.toString();
        }
        queryParams['$orderby'] = 'OrderCreatedDateTime desc';
        break;

      case 'sap':
        const sapFilters: string[] = [];
        if (params.customerId) {
          sapFilters.push(`SoldToParty eq '${params.customerId}'`);
        }
        if (params.dateRange) {
          sapFilters.push(`CreationDate ge datetime'${params.dateRange.startDate}T00:00:00'`);
          sapFilters.push(`CreationDate le datetime'${params.dateRange.endDate}T23:59:59'`);
        }
        if (sapFilters.length > 0) {
          queryParams['$filter'] = sapFilters.join(' and ');
        }
        if (params.limit) {
          queryParams['$top'] = params.limit.toString();
        }
        if (params.offset) {
          queryParams['$skip'] = params.offset.toString();
        }
        break;

      default:
        if (params.customerId) {
          queryParams['customer_id'] = params.customerId;
        }
        if (params.dateRange) {
          queryParams['start_date'] = params.dateRange.startDate;
          queryParams['end_date'] = params.dateRange.endDate;
        }
        if (params.status) {
          queryParams['status'] = params.status;
        }
        if (params.limit) {
          queryParams['limit'] = params.limit.toString();
        }
        if (params.offset) {
          queryParams['offset'] = params.offset.toString();
        }
        break;
    }

    return queryParams;
  }

  private buildDelayedOrdersParams(today: string): Record<string, string> {
    switch (this.config.type) {
      case 'd365':
        return {
          '$filter': `RequestedShippingDate lt ${today}T00:00:00Z and SalesOrderStatus ne 'Invoiced' and SalesOrderStatus ne 'Cancelled'`,
          '$orderby': 'RequestedShippingDate asc',
        };
      case 'sap':
        return {
          '$filter': `RequestedDeliveryDate lt datetime'${today}T00:00:00' and OverallDeliveryStatus ne 'C'`,
        };
      default:
        return {
          'promised_before': today,
          'exclude_status': 'delivered,cancelled',
        };
    }
  }

  private mapStatusToD365(status: OrderStatus): string {
    const statusMap: Record<OrderStatus, string> = {
      'pending': 'Open',
      'confirmed': 'Confirmed',
      'processing': 'InProgress',
      'partially_shipped': 'PartiallyDelivered',
      'shipped': 'Delivered',
      'delivered': 'Invoiced',
      'cancelled': 'Cancelled',
      'on_hold': 'OnHold',
    };
    return statusMap[status] || 'Open';
  }

  // Data mapping functions
  private mapToOrder(data: Record<string, unknown>): Order {
    switch (this.config.type) {
      case 'd365':
        return this.mapD365Order(data);
      case 'sap':
        return this.mapSapOrder(data);
      default:
        return this.mapGenericOrder(data);
    }
  }

  private mapToOrders(data: Record<string, unknown>): Order[] {
    const records = this.config.type === 'd365' || this.config.type === 'sap'
      ? (data.value as Record<string, unknown>[]) || []
      : (data.orders as Record<string, unknown>[]) || (data as Record<string, unknown>[]) || [];

    return records.map((record) => this.mapToOrder(record));
  }

  private mapD365Order(data: Record<string, unknown>): Order {
    const lines = (data.SalesOrderLines as Record<string, unknown>[]) || [];

    return {
      orderId: data.SalesOrderNumber as string,
      orderNumber: data.SalesOrderNumber as string,
      customerId: data.CustomerAccount as string,
      customerName: data.CustomerName as string || '',
      orderDate: data.OrderCreatedDateTime as string,
      requestedDeliveryDate: data.RequestedShippingDate as string,
      promisedDeliveryDate: data.ConfirmedShippingDate as string,
      status: this.mapD365Status(data.SalesOrderStatus as string),
      totalAmount: data.TotalDiscountAmount as number || 0,
      currency: data.CurrencyCode as string || 'USD',
      lineItems: lines.map((line) => this.mapD365LineItem(line)),
      shippingAddress: this.mapD365Address(data, 'Delivery'),
      billingAddress: this.mapD365Address(data, 'Invoice'),
      notes: data.DeliveryAddressDescription as string,
      createdAt: data.OrderCreatedDateTime as string,
      updatedAt: data.ModifiedDateTime as string,
    };
  }

  private mapD365LineItem(data: Record<string, unknown>): OrderLineItem {
    return {
      lineId: data.LineNumber as string,
      productId: data.ItemId as string,
      productName: data.ProductName as string || '',
      sku: data.ItemId as string,
      quantity: data.OrderedSalesQuantity as number || 0,
      unitPrice: data.SalesPrice as number || 0,
      lineTotal: data.LineAmount as number || 0,
      status: this.mapD365LineStatus(data.SalesStatus as string),
      quantityShipped: data.DeliveredQuantity as number || 0,
      quantityRemaining: (data.OrderedSalesQuantity as number || 0) - (data.DeliveredQuantity as number || 0),
    };
  }

  private mapD365Status(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'Open': 'pending',
      'Confirmed': 'confirmed',
      'InProgress': 'processing',
      'PartiallyDelivered': 'partially_shipped',
      'Delivered': 'shipped',
      'Invoiced': 'delivered',
      'Cancelled': 'cancelled',
      'OnHold': 'on_hold',
    };
    return statusMap[status] || 'pending';
  }

  private mapD365LineStatus(status: string): LineItemStatus {
    const statusMap: Record<string, LineItemStatus> = {
      'Open': 'pending',
      'Reserved': 'allocated',
      'Picked': 'picking',
      'Packed': 'packed',
      'Delivered': 'shipped',
      'Invoiced': 'delivered',
      'Cancelled': 'cancelled',
      'Backorder': 'backordered',
    };
    return statusMap[status] || 'pending';
  }

  private mapD365Address(data: Record<string, unknown>, type: string): Address {
    return {
      line1: data[`${type}AddressStreet`] as string || '',
      line2: data[`${type}AddressStreetNumber`] as string,
      city: data[`${type}AddressCity`] as string || '',
      state: data[`${type}AddressState`] as string || '',
      postalCode: data[`${type}AddressZipCode`] as string || '',
      country: data[`${type}AddressCountryRegionId`] as string || '',
    };
  }

  private mapSapOrder(data: Record<string, unknown>): Order {
    const items = (data.to_Item as { results?: Record<string, unknown>[] })?.results || [];

    return {
      orderId: data.SalesOrder as string,
      orderNumber: data.SalesOrder as string,
      customerId: data.SoldToParty as string,
      customerName: data.SoldToPartyName as string || '',
      orderDate: data.CreationDate as string,
      requestedDeliveryDate: data.RequestedDeliveryDate as string,
      promisedDeliveryDate: data.RequestedDeliveryDate as string,
      status: this.mapSapStatus(data.OverallDeliveryStatus as string),
      totalAmount: parseFloat(data.TotalNetAmount as string) || 0,
      currency: data.TransactionCurrency as string || 'USD',
      lineItems: items.map((item) => this.mapSapLineItem(item)),
      shippingAddress: {
        line1: data.ShipToPartyAddress as string || '',
        city: data.ShipToPartyCity as string || '',
        state: data.ShipToPartyRegion as string || '',
        postalCode: data.ShipToPartyPostalCode as string || '',
        country: data.ShipToPartyCountry as string || '',
      },
      billingAddress: {
        line1: data.BillToPartyAddress as string || '',
        city: data.BillToPartyCity as string || '',
        state: data.BillToPartyRegion as string || '',
        postalCode: data.BillToPartyPostalCode as string || '',
        country: data.BillToPartyCountry as string || '',
      },
      createdAt: data.CreationDate as string,
      updatedAt: data.LastChangeDate as string,
    };
  }

  private mapSapLineItem(data: Record<string, unknown>): OrderLineItem {
    return {
      lineId: data.SalesOrderItem as string,
      productId: data.Material as string,
      productName: data.ProductDescription as string || '',
      sku: data.Material as string,
      quantity: parseFloat(data.RequestedQuantity as string) || 0,
      unitPrice: parseFloat(data.NetPriceAmount as string) || 0,
      lineTotal: parseFloat(data.NetAmount as string) || 0,
      status: this.mapSapLineStatus(data.DeliveryStatus as string),
      quantityShipped: parseFloat(data.ConfdDelivQtyInOrderQtyUnit as string) || 0,
      quantityRemaining: parseFloat(data.RequestedQuantity as string) - parseFloat(data.ConfdDelivQtyInOrderQtyUnit as string) || 0,
    };
  }

  private mapSapStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'A': 'pending',
      'B': 'partially_shipped',
      'C': 'delivered',
    };
    return statusMap[status] || 'pending';
  }

  private mapSapLineStatus(status: string): LineItemStatus {
    const statusMap: Record<string, LineItemStatus> = {
      'A': 'pending',
      'B': 'allocated',
      'C': 'shipped',
    };
    return statusMap[status] || 'pending';
  }

  private mapGenericOrder(data: Record<string, unknown>): Order {
    const lines = (data.line_items as Record<string, unknown>[]) || (data.lineItems as Record<string, unknown>[]) || [];

    return {
      orderId: (data.order_id || data.orderId || data.id) as string,
      orderNumber: (data.order_number || data.orderNumber) as string,
      customerId: (data.customer_id || data.customerId) as string,
      customerName: (data.customer_name || data.customerName) as string || '',
      orderDate: (data.order_date || data.orderDate || data.created_at) as string,
      requestedDeliveryDate: (data.requested_delivery_date || data.requestedDeliveryDate) as string,
      promisedDeliveryDate: (data.promised_delivery_date || data.promisedDeliveryDate) as string,
      status: (data.status as OrderStatus) || 'pending',
      totalAmount: (data.total_amount || data.totalAmount || data.total) as number || 0,
      currency: (data.currency || 'USD') as string,
      lineItems: lines.map((line) => this.mapGenericLineItem(line)),
      shippingAddress: this.mapGenericAddress(data.shipping_address || data.shippingAddress || {}),
      billingAddress: this.mapGenericAddress(data.billing_address || data.billingAddress || {}),
      notes: data.notes as string,
      createdAt: (data.created_at || data.createdAt) as string,
      updatedAt: (data.updated_at || data.updatedAt) as string,
    };
  }

  private mapGenericLineItem(data: Record<string, unknown>): OrderLineItem {
    return {
      lineId: (data.line_id || data.lineId || data.id) as string,
      productId: (data.product_id || data.productId) as string,
      productName: (data.product_name || data.productName || data.name) as string || '',
      sku: (data.sku || data.product_id || data.productId) as string,
      quantity: (data.quantity || data.qty) as number || 0,
      unitPrice: (data.unit_price || data.unitPrice || data.price) as number || 0,
      lineTotal: (data.line_total || data.lineTotal || data.total) as number || 0,
      status: (data.status as LineItemStatus) || 'pending',
      quantityShipped: (data.quantity_shipped || data.quantityShipped || data.shipped) as number || 0,
      quantityRemaining: (data.quantity_remaining || data.quantityRemaining || data.remaining) as number || 0,
    };
  }

  private mapGenericAddress(data: Record<string, unknown>): Address {
    return {
      line1: (data.line1 || data.address1 || data.street) as string || '',
      line2: (data.line2 || data.address2) as string,
      city: data.city as string || '',
      state: (data.state || data.province || data.region) as string || '',
      postalCode: (data.postal_code || data.postalCode || data.zip || data.zipCode) as string || '',
      country: (data.country || data.countryCode) as string || '',
    };
  }

  private mapToCustomer(data: Record<string, unknown>): Customer {
    switch (this.config.type) {
      case 'd365':
        return {
          customerId: data.CustomerAccount as string,
          customerNumber: data.CustomerAccount as string,
          name: data.OrganizationName as string || '',
          email: data.PrimaryContactEmail as string || '',
          phone: data.PrimaryContactPhone as string,
          billingAddress: this.mapD365Address(data, 'Invoice'),
          shippingAddresses: [this.mapD365Address(data, 'Delivery')],
          creditLimit: data.CreditLimit as number,
          paymentTerms: data.PaymentTermsId as string,
        };
      case 'sap':
        return {
          customerId: data.Customer as string,
          customerNumber: data.Customer as string,
          name: data.CustomerName as string || '',
          email: data.EmailAddress as string || '',
          phone: data.PhoneNumber as string,
          billingAddress: {
            line1: data.StreetAddress as string || '',
            city: data.CityName as string || '',
            state: data.Region as string || '',
            postalCode: data.PostalCode as string || '',
            country: data.Country as string || '',
          },
          shippingAddresses: [],
          paymentTerms: data.PaymentTerms as string,
        };
      default:
        return {
          customerId: (data.customer_id || data.customerId || data.id) as string,
          customerNumber: (data.customer_number || data.customerNumber) as string,
          name: data.name as string || '',
          email: data.email as string || '',
          phone: data.phone as string,
          billingAddress: this.mapGenericAddress(data.billing_address || data.billingAddress || {}),
          shippingAddresses: ((data.shipping_addresses || data.shippingAddresses || []) as Record<string, unknown>[]).map(
            (addr) => this.mapGenericAddress(addr)
          ),
          creditLimit: (data.credit_limit || data.creditLimit) as number,
          paymentTerms: (data.payment_terms || data.paymentTerms) as string,
        };
    }
  }
}

// Singleton instance
let erpConnector: ErpConnector | null = null;

export function initializeErpConnector(config: ErpConfig): ErpConnector {
  erpConnector = new ErpConnector(config);
  return erpConnector;
}

export function getErpConnector(): ErpConnector {
  if (!erpConnector) {
    throw new Error('ERP connector not initialized. Call initializeErpConnector first.');
  }
  return erpConnector;
}

export function createErpConnectorFromEnv(): ErpConnector {
  const config: ErpConfig = {
    type: (process.env.ERP_TYPE as ErpType) || 'generic',
    baseUrl: process.env.ERP_BASE_URL || 'http://localhost:3000',
    apiKey: process.env.ERP_API_KEY,
    clientId: process.env.ERP_CLIENT_ID,
    clientSecret: process.env.ERP_CLIENT_SECRET,
    tenantId: process.env.ERP_TENANT_ID,
    username: process.env.ERP_USERNAME,
    password: process.env.ERP_PASSWORD,
  };
  return initializeErpConnector(config);
}

export default ErpConnector;
