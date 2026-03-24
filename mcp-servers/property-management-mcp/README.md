# Property Management MCP Server

An industry-specific MCP (Model Context Protocol) server for real estate and property management systems. This server provides AI assistants with access to property, lease, tenant, maintenance, and financial data from property management platforms like AppFolio, Buildium, or custom systems.

## Features

### Property Management Tools
- **list_properties** - List properties with filters for type (residential/commercial/mixed/industrial), status, and manager
- **get_property** - Get detailed property information including all units and their occupancy status
- **get_property_financials** - Get financial metrics including NOI, maintenance costs, and collection rate
- **get_vacancy_report** - View all current vacancies across the portfolio

### Lease Management Tools
- **list_leases** - List leases with filters for property, status, and expiration timeframe
- **get_lease** - Get detailed lease information including tenant, dates, and renewal status
- **get_expiring_leases** - Find leases expiring within a specified number of days
- **get_lease_renewals** - View all pending lease renewals awaiting tenant response

### Tenant Management Tools
- **list_tenants** - List tenants with filters for property and status
- **get_tenant** - Get tenant details including contact info, balance, and payment history
- **get_delinquent_tenants** - Find all tenants with overdue rent balances
- **search_tenants** - Search tenants by name, email, or phone number

### Maintenance Tools
- **list_work_orders** - List work orders with filters for property, status, and priority
- **get_work_order** - Get detailed work order information including costs and status
- **get_open_maintenance** - View all open and in-progress maintenance requests
- **get_maintenance_costs** - Get maintenance spending report by property with category breakdown

### Financial Tools
- **get_rent_roll** - Get rent roll showing all occupied units with balances
- **get_income_statement** - Get income statement with revenue and expense categories
- **get_collections_report** - View rent collection status and rates by property

## Supported Property Management Systems

### AppFolio
AppFolio is a cloud-based property management software for residential and commercial properties.

**Setup:**
1. Log in to your AppFolio account
2. Navigate to Settings > API Access
3. Generate API credentials (Client ID and Client Secret)
4. Note your database name from your AppFolio URL (e.g., `yourcompany.appfolio.com`)

### Buildium
Buildium is property management software for residential property managers.

**Setup:**
1. Log in to your Buildium account
2. Go to Settings > API > Developer Portal
3. Create a new application to get Client ID and Client Secret
4. Configure OAuth scopes for the data you need to access

### Generic API
For custom property management systems or self-hosted solutions that expose a REST API.

**Setup:**
1. Ensure your API follows REST conventions
2. Configure the base URL and authentication credentials
3. The connector expects standard endpoints like `/properties`, `/leases`, `/tenants`, etc.

## Installation

```bash
# Clone or copy the server files
cd property-management-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Choose your provider
PROPERTY_MANAGEMENT_PROVIDER=generic  # Options: appfolio, buildium, generic

# AppFolio Configuration
APPFOLIO_CLIENT_ID=your_client_id
APPFOLIO_CLIENT_SECRET=your_client_secret
APPFOLIO_DATABASE_NAME=your_database_name

# Buildium Configuration
BUILDIUM_CLIENT_ID=your_client_id
BUILDIUM_CLIENT_SECRET=your_client_secret

# Generic API Configuration
PROPERTY_API_BASE_URL=https://api.your-property-system.com
PROPERTY_API_KEY=your_api_key

# Server Configuration
PORT=8000
LOG_LEVEL=info

# Demo Mode (uses mock data)
DEMO_MODE=true
```

## Demo Mode

The server includes a demo mode with realistic mock data for testing and development. Enable it by setting `DEMO_MODE=true` in your environment. Demo mode includes:

- 3 sample properties (residential and commercial)
- Multiple units with various occupancy statuses
- Active leases with different expiration dates
- Tenants with payment histories and balances
- Work orders across different priorities and categories
- Financial data including rent rolls and income statements

## Docker

Build and run with Docker:

```bash
# Build the image
docker build -t property-management-mcp .

# Run the container
docker run -p 8000:8000 \
  -e DEMO_MODE=true \
  property-management-mcp

# Or with production credentials
docker run -p 8000:8000 \
  -e PROPERTY_MANAGEMENT_PROVIDER=appfolio \
  -e APPFOLIO_CLIENT_ID=your_client_id \
  -e APPFOLIO_CLIENT_SECRET=your_client_secret \
  -e APPFOLIO_DATABASE_NAME=your_database \
  property-management-mcp
```

## Use Cases

### Property Managers
- "Show me all properties managed by John Smith"
- "What are the current vacancies across the portfolio?"
- "Which leases are expiring in the next 30 days?"
- "Get the rent roll for Sunset Apartments"

### Maintenance Coordination
- "What emergency maintenance requests are open?"
- "Show maintenance costs by category for last month"
- "List all HVAC work orders"
- "How much have we spent on plumbing repairs this year?"

### Tenant Relations
- "Find all tenants with overdue balances"
- "Search for a tenant named Martinez"
- "Show me Michael Brown's payment history"
- "Which tenants are pending lease renewals?"

### Financial Analysis
- "Generate an income statement for Q1 2024"
- "What's our current collection rate?"
- "Compare NOI across all properties"
- "Show rent collection status by property"

### Lease Administration
- "List all active leases for PROP-001"
- "Which tenants haven't responded to renewal offers?"
- "Show lease details for LEASE-003"
- "Find leases expiring in the next 60 days"

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with server status and available tools |
| `/sse` | GET | SSE endpoint for MCP client connections |
| `/messages` | POST | Message handler for MCP requests |

## Architecture

```
property-management-mcp/
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── server.ts             # MCP server setup and tool registration
│   ├── connectors/
│   │   └── property.ts       # Property management system connector
│   └── tools/
│       ├── property-tools.ts # Property listing and details
│       ├── lease-tools.ts    # Lease management
│       ├── tenant-tools.ts   # Tenant information
│       ├── maintenance-tools.ts # Work order management
│       └── financial-tools.ts   # Financial reporting
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## Security Considerations

- API credentials are stored in environment variables, not in code
- Docker container runs as non-root user
- HTTPS should be used in production (configure via reverse proxy)
- Implement rate limiting for production deployments
- Consider implementing tenant data access controls based on user roles

## License

MIT
