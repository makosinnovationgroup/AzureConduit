# Vendor Management MCP Server

A cross-system MCP (Model Context Protocol) server that aggregates vendor data from Accounts Payable, Contract Management, and Performance systems. This server provides a unified interface for AI assistants to access comprehensive vendor information across multiple enterprise systems.

## Overview

The Vendor Management MCP server acts as an aggregation layer, connecting to:

- **Accounts Payable Systems**: D365 Finance, QuickBooks, or custom REST APIs
- **Contract Management Systems**: DocuSign CLM or custom REST APIs
- **Performance Management Systems**: Custom quality and performance tracking

## Use Cases

### Procurement Operations
- **Vendor Selection**: Compare vendors based on price, quality, and delivery performance
- **Spend Analysis**: Identify top vendors by spend and analyze purchasing patterns
- **Supplier Consolidation**: Find opportunities to consolidate vendors in the same category

### Vendor Reviews
- **Performance Assessments**: Get comprehensive scorecards with quality, delivery, and pricing metrics
- **Risk Identification**: Identify underperforming vendors before issues escalate
- **Relationship Management**: Track all contracts, invoices, and performance history for vendor meetings

### Financial Audits
- **AP Aging Analysis**: Review outstanding payables by age bucket across all vendors
- **Payment Verification**: Trace payment history for any vendor
- **Contract Compliance**: Verify payment terms against contract obligations

### Contract Management
- **Renewal Planning**: Get alerts on contracts expiring in the next 30/60/90 days
- **Obligation Tracking**: Review contract terms and key obligations
- **Amendment History**: Track all contract modifications and their effective dates

### Risk Management
- **Vendor Concentration**: Identify over-reliance on specific vendors
- **Performance Trending**: Spot declining performance before it impacts operations
- **Compliance Monitoring**: Track vendor compliance scores and incidents

## Tools

### Vendor Tools
| Tool | Description | Parameters |
|------|-------------|------------|
| `get_vendor_summary` | Complete vendor profile with financials, contracts, and performance | `vendor_id` |
| `list_vendors` | List all vendors with optional filters | `category?`, `status?` |
| `search_vendors` | Search vendors by name or category | `query` |
| `get_top_vendors` | Top vendors ranked by total spend | `limit?` |

### Accounts Payable Tools
| Tool | Description | Parameters |
|------|-------------|------------|
| `get_vendor_invoices` | Invoices for a vendor | `vendor_id`, `status?` |
| `get_ap_aging` | AP aging report by vendor | `vendor_id?` |
| `get_payment_history` | Payment history for a vendor | `vendor_id` |
| `get_overdue_payables` | All overdue vendor invoices | `min_amount?`, `days_overdue?` |

### Contract Tools
| Tool | Description | Parameters |
|------|-------------|------------|
| `get_vendor_contracts` | Active contracts for a vendor | `vendor_id` |
| `get_expiring_contracts` | Contracts expiring within N days | `days?` (default: 90) |
| `get_contract_details` | Full contract terms and obligations | `contract_id` |

### Performance Tools
| Tool | Description | Parameters |
|------|-------------|------------|
| `get_vendor_scorecard` | Performance metrics and analysis | `vendor_id` |
| `get_underperforming_vendors` | Vendors below performance threshold | `threshold?` (default: 70) |

## Setup

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

### Configuration

Copy `.env.example` to `.env` and configure your systems:

```bash
cp .env.example .env
```

#### AP System Configuration

Choose one of: `d365`, `quickbooks`, or `generic`

```env
# For D365 Finance
AP_SYSTEM=d365
D365_TENANT_ID=your-tenant-id
D365_CLIENT_ID=your-client-id
D365_CLIENT_SECRET=your-client-secret
D365_ENVIRONMENT_URL=https://your-environment.operations.dynamics.com

# For QuickBooks
AP_SYSTEM=quickbooks
QB_CLIENT_ID=your-client-id
QB_CLIENT_SECRET=your-client-secret
QB_REALM_ID=your-realm-id
QB_REFRESH_TOKEN=your-refresh-token
QB_ENVIRONMENT=sandbox

# For Generic REST API
AP_SYSTEM=generic
GENERIC_AP_API_URL=http://localhost:3001/api/ap
GENERIC_AP_API_KEY=your-api-key
```

#### Contract System Configuration

Choose one of: `docusign` or `generic`

```env
# For DocuSign CLM
CONTRACT_SYSTEM=docusign
DOCUSIGN_ACCOUNT_ID=your-account-id
DOCUSIGN_ACCESS_TOKEN=your-access-token
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi

# For Generic REST API
CONTRACT_SYSTEM=generic
GENERIC_CONTRACT_API_URL=http://localhost:3002/api/contracts
GENERIC_CONTRACT_API_KEY=your-api-key
```

#### Performance System Configuration

```env
PERFORMANCE_API_URL=http://localhost:3000/api/performance
PERFORMANCE_API_KEY=your-api-key
```

### Docker

```bash
# Build the image
docker build -t vendor-management-mcp .

# Run the container
docker run -p 8000:8000 \
  -e AP_SYSTEM=generic \
  -e CONTRACT_SYSTEM=generic \
  vendor-management-mcp
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /sse` - SSE endpoint for MCP client connections
- `POST /messages` - Messages endpoint for MCP requests

## Example Queries

### Get a complete vendor profile
```
"Show me everything about vendor VEND-001"
```
Uses: `get_vendor_summary`

### Find underperforming vendors
```
"Which vendors have a performance score below 70?"
```
Uses: `get_underperforming_vendors`

### Contract renewal planning
```
"What contracts are expiring in the next 60 days?"
```
Uses: `get_expiring_contracts`

### AP aging review
```
"Show me the AP aging report for all vendors"
```
Uses: `get_ap_aging`

### Spend analysis
```
"Who are our top 10 vendors by spend?"
```
Uses: `get_top_vendors`

## Development

```bash
# Run in development mode
npm run dev

# The server will start on port 8000 (or PORT env variable)
```

## Architecture

```
vendor-management-mcp/
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── server.ts             # MCP server setup and tool registration
│   ├── connectors/
│   │   ├── ap.ts             # Accounts Payable connector
│   │   ├── contracts.ts      # Contract management connector
│   │   └── performance.ts    # Performance/quality connector
│   └── tools/
│       ├── vendor-tools.ts   # Vendor aggregation tools
│       ├── ap-tools.ts       # AP-specific tools
│       ├── contract-tools.ts # Contract-specific tools
│       └── performance-tools.ts # Performance-specific tools
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## License

MIT
