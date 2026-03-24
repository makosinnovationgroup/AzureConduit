# Order Status MCP Server

A cross-system aggregator MCP server that combines ERP, shipping, and inventory data to provide unified order status information.

## Overview

This MCP server acts as a middleware layer that aggregates data from multiple backend systems:

- **ERP Systems**: Microsoft Dynamics 365 Supply Chain Management, SAP S/4HANA, or generic REST APIs
- **Shipping Carriers**: ShipStation (multi-carrier), FedEx, UPS, or generic shipping APIs
- **Inventory Systems**: ERP-based inventory, Warehouse Management Systems (WMS), or generic inventory APIs

## Use Cases

### Customer Service
- **"Where is my order?"** - Agents can quickly look up complete order status including shipping and tracking
- **Order history** - View recent orders for a customer
- **Proactive communication** - Identify delayed orders before customers call

### Logistics Planning
- **In-transit monitoring** - Track all shipments currently in transit
- **Delay management** - Identify orders behind schedule for escalation
- **Carrier performance** - Monitor shipments by carrier and status

### Inventory Management
- **Availability checking** - Verify stock before promising delivery
- **Stock alerts** - Monitor low stock items approaching reorder point
- **Multi-warehouse visibility** - See inventory across all locations

## Available Tools

### Order Tools

| Tool | Description |
|------|-------------|
| `get_order_status` | Complete order status with order details, line items, shipping status, tracking, and ETA |
| `search_orders` | Search orders by customer, date range, or status |
| `get_recent_orders` | Get most recent orders for a customer |
| `get_delayed_orders` | Get all orders that are behind schedule |

### Shipping Tools

| Tool | Description |
|------|-------------|
| `get_tracking` | Get detailed tracking information including current location and all events |
| `get_shipments_in_transit` | Get all shipments currently in transit |
| `get_delivery_eta` | Get estimated delivery date for an order |

### Inventory Tools

| Tool | Description |
|------|-------------|
| `check_availability` | Check if a quantity of product is available |
| `get_inventory_levels` | Get current inventory levels for products |
| `get_low_stock_alerts` | Get products below their reorder point |

## Quick Start

### Prerequisites

- Node.js 18+
- Access to ERP, shipping, and/or inventory systems

### Installation

```bash
cd order-status-mcp
npm install
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure your systems in `.env`:

```env
# ERP System
ERP_TYPE=d365
ERP_BASE_URL=https://your-org.operations.dynamics.com
ERP_CLIENT_ID=your-client-id
ERP_CLIENT_SECRET=your-client-secret
ERP_TENANT_ID=your-tenant-id

# Shipping Carrier
SHIPPING_CARRIER=shipstation
SHIPPING_API_KEY=your-api-key
SHIPPING_API_SECRET=your-api-secret

# Inventory (uses ERP by default)
INVENTORY_SYSTEM_TYPE=erp
```

### Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

### Docker

Build:
```bash
docker build -t order-status-mcp .
```

Run:
```bash
docker run -p 8000:8000 --env-file .env order-status-mcp
```

## Supported Systems

### ERP Systems

| System | Type | Authentication |
|--------|------|----------------|
| Microsoft Dynamics 365 SCM | `d365` | OAuth 2.0 (Azure AD) |
| SAP S/4HANA | `sap` | Basic Auth or OAuth |
| Generic REST API | `generic` | API Key |

### Shipping Carriers

| Carrier | Type | Notes |
|---------|------|-------|
| ShipStation | `shipstation` | Multi-carrier aggregator (recommended) |
| FedEx | `fedex` | Direct FedEx API |
| UPS | `ups` | Direct UPS API |
| Generic | `generic` | Custom shipping API |

### Inventory Systems

| System | Type | Notes |
|--------|------|-------|
| ERP-based | `erp` | Uses ERP connection for inventory |
| WMS | `wms` | Warehouse Management System API |
| Generic | `generic` | Custom inventory API |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with system status |
| `/sse` | GET | SSE endpoint for MCP connection |
| `/messages` | POST | Message endpoint for MCP requests |

## Example Workflows

### Customer Service: Order Lookup

```
User: "Where is order ORD-12345?"

1. Call get_order_status with order_id="ORD-12345"
2. Returns:
   - Order details (items, amounts, dates)
   - Shipping status (carrier, tracking number)
   - Tracking events (pickup, in transit, out for delivery)
   - Estimated delivery date
   - Delay status and reason (if applicable)
```

### Logistics: Morning Briefing

```
User: "Give me a logistics update"

1. Call get_delayed_orders to find orders behind schedule
2. Call get_shipments_in_transit to see active shipments
3. Call get_low_stock_alerts to check inventory issues

Returns summary of:
- X orders delayed, Y critical
- Z shipments in transit by carrier
- N products below reorder point
```

### Sales: Can We Fulfill This Order?

```
User: "Can we ship 100 units of SKU-ABC today?"

1. Call check_availability with product_id="SKU-ABC", quantity=100
2. Returns:
   - Available: Yes/No
   - Quantity available by warehouse
   - Recommendation for fulfillment
   - Alternative options if not available
```

## Architecture

```
                    ┌─────────────────────┐
                    │  MCP Client (AI)    │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Order Status MCP   │
                    │      Server         │
                    └─────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ERP Connector  │  │Shipping Connector│  │Inventory Connect│
│  (D365/SAP/...) │  │(ShipStation/...) │  │  (ERP/WMS/...)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │   ERP   │          │ Carrier │          │   WMS   │
    │ System  │          │  APIs   │          │ System  │
    └─────────┘          └─────────┘          └─────────┘
```

## Error Handling

The server handles errors gracefully:
- Invalid parameters are validated with Zod schemas
- API errors are caught and returned with meaningful messages
- Connection failures trigger automatic reconnection attempts
- Rate limiting is respected for carrier APIs

## Security Considerations

- Credentials are stored in environment variables, not code
- Docker container runs as non-root user
- All carrier API tokens are refreshed automatically
- No sensitive data is logged

## Development

### Project Structure

```
order-status-mcp/
├── src/
│   ├── index.ts           # Entry point with HTTP server
│   ├── server.ts          # MCP server setup
│   ├── connectors/
│   │   ├── erp.ts         # ERP system connector
│   │   ├── shipping.ts    # Shipping carrier connector
│   │   └── inventory.ts   # Inventory system connector
│   └── tools/
│       ├── order-tools.ts     # Order-related tools
│       ├── shipping-tools.ts  # Shipping-related tools
│       └── inventory-tools.ts # Inventory-related tools
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

### Adding New Tools

1. Define schema with Zod in the appropriate tools file
2. Implement handler function
3. Add to the tools array for registration
4. The server automatically registers all tools on startup

## License

MIT
