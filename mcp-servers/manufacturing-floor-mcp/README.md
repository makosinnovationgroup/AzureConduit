# Manufacturing Floor MCP Server

An industry-specific Model Context Protocol (MCP) server for manufacturing floor operations. This server integrates with Manufacturing Execution Systems (MES), ERP systems, and Quality Management Systems to provide real-time visibility into production operations.

## Features

### Production Management
- **Real-time Production Status**: Monitor all production lines with current status, production rates, and efficiency metrics
- **Work Order Tracking**: Get detailed status of work orders including quantities, schedules, and customer information
- **Production Scheduling**: View today's or weekly production schedule with priorities and timing
- **Line Efficiency (OEE)**: Overall Equipment Effectiveness metrics including availability, performance, and quality

### Inventory Management
- **Raw Material Levels**: Track raw material inventory with safety stock alerts
- **Work-In-Progress (WIP)**: Monitor items currently in production with status and location
- **Finished Goods**: View completed inventory ready for shipment
- **Material Shortages**: Identify materials below safety stock with affected work orders

### Quality Management
- **Quality Metrics**: First pass yield, defect rates, scrap and rework percentages
- **Defect Tracking**: Recent quality issues with severity, root cause, and corrective actions
- **Quality Holds**: Products on hold for inspection, investigation, or quarantine
- **Inspection Results**: Recent inspection data with pass/fail rates and measurements

### Equipment Management
- **Equipment Status**: Real-time status of all production equipment
- **Downtime Reporting**: Track unplanned downtime, planned maintenance, and changeovers
- **Maintenance Scheduling**: Upcoming preventive maintenance with parts and resource requirements

## Use Cases

### Production Supervisors
- Monitor real-time production status across all lines
- Track work order progress and identify delays
- Respond quickly to equipment issues and quality problems
- Ensure production targets are being met

### Production Planners
- View and manage the production schedule
- Identify material shortages that may impact production
- Track work order completion and plan capacity
- Optimize resource allocation across lines

### Quality Managers
- Monitor quality metrics and trends
- Investigate and resolve defects
- Manage quality holds and dispositions
- Ensure inspection compliance

### Maintenance Teams
- Track equipment status and health
- Plan preventive maintenance activities
- Respond to unplanned downtime events
- Manage parts inventory for maintenance

### Plant Managers
- Get high-level overview of plant operations
- Identify bottlenecks and improvement opportunities
- Track KPIs across production, quality, and maintenance
- Make data-driven decisions

## Available Tools

### Production Tools
| Tool | Description |
|------|-------------|
| `get_production_status` | Current production status across all lines |
| `get_work_order_status` | Detailed status of a specific work order |
| `list_work_orders` | List work orders with filtering options |
| `get_production_schedule` | Today's or weekly production schedule |
| `get_line_efficiency` | OEE and efficiency metrics for a production line |

### Inventory Tools
| Tool | Description |
|------|-------------|
| `get_raw_material_levels` | Raw material inventory with safety stock status |
| `get_wip_inventory` | Work-in-progress items by operation and status |
| `get_finished_goods` | Finished goods inventory with quality status |
| `get_material_shortages` | Materials below safety stock affecting production |

### Quality Tools
| Tool | Description |
|------|-------------|
| `get_quality_metrics` | Defect rates, first pass yield, and quality KPIs |
| `get_recent_defects` | Recent quality issues with root cause analysis |
| `get_quality_holds` | Products currently on quality hold |
| `get_inspection_results` | Recent inspection results and measurements |

### Equipment Tools
| Tool | Description |
|------|-------------|
| `get_equipment_status` | Status of production equipment with alerts |
| `get_downtime_report` | Downtime events by equipment and reason |
| `get_maintenance_schedule` | Upcoming preventive maintenance tasks |

## System Integration

### MES (Manufacturing Execution System)
The server integrates with MES systems to provide:
- Real-time production line status
- Production rates and counts
- OEE calculations
- Production scheduling data

### ERP System
ERP integration provides:
- Work order management
- Inventory levels (raw materials, WIP, finished goods)
- Material planning data
- Customer order information

### Quality Management System
Quality system integration delivers:
- Quality metrics and KPIs
- Defect tracking and analysis
- Quality hold management
- Inspection results and measurements

## Installation

### Prerequisites
- Node.js 20 or later
- Access to MES, ERP, and Quality Management systems
- API credentials for each system

### Setup

1. Clone the repository and navigate to the server directory:
```bash
cd mcp-servers/manufacturing-floor-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
# MES Configuration
MES_BASE_URL=https://your-mes-server.com
MES_API_KEY=your-mes-api-key
MES_PLANT_ID=PLANT-001

# ERP Configuration
ERP_BASE_URL=https://your-erp-server.com
ERP_API_KEY=your-erp-api-key
ERP_COMPANY_ID=COMPANY-001

# Quality System Configuration
QUALITY_BASE_URL=https://your-quality-server.com
QUALITY_API_KEY=your-quality-api-key
QUALITY_SITE_ID=SITE-001
```

5. Build the server:
```bash
npm run build
```

6. Start the server:
```bash
npm start
```

## Docker Deployment

Build the Docker image:
```bash
docker build -t manufacturing-floor-mcp .
```

Run the container:
```bash
docker run -d \
  -p 8000:8000 \
  -e MES_BASE_URL=https://your-mes-server.com \
  -e MES_API_KEY=your-mes-api-key \
  -e MES_PLANT_ID=PLANT-001 \
  -e ERP_BASE_URL=https://your-erp-server.com \
  -e ERP_API_KEY=your-erp-api-key \
  -e ERP_COMPANY_ID=COMPANY-001 \
  -e QUALITY_BASE_URL=https://your-quality-server.com \
  -e QUALITY_API_KEY=your-quality-api-key \
  -e QUALITY_SITE_ID=SITE-001 \
  --name manufacturing-floor-mcp \
  manufacturing-floor-mcp
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with connector status |
| `/sse` | GET | Server-Sent Events endpoint for MCP |
| `/messages` | POST | Message endpoint for MCP communication |

## Example Queries

### Check Production Status
"What is the current status of all production lines?"

### Track a Work Order
"What is the status of work order WO-2024-0001?"

### Find Material Shortages
"Are there any materials below safety stock that could affect production?"

### Review Quality Issues
"Show me any critical or major defects from today"

### Check Equipment Health
"Which equipment is currently down or in maintenance?"

### Plan Maintenance
"What maintenance is scheduled for the next 7 days?"

## Development

### Running in Development Mode
```bash
npm run dev
```

### Project Structure
```
manufacturing-floor-mcp/
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── server.ts             # MCP server setup
│   ├── connectors/
│   │   ├── mes.ts            # MES connector
│   │   ├── erp.ts            # ERP connector
│   │   └── quality.ts        # Quality system connector
│   ├── tools/
│   │   ├── production-tools.ts
│   │   ├── inventory-tools.ts
│   │   ├── quality-tools.ts
│   │   └── equipment-tools.ts
│   └── utils/
│       └── logger.ts
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## License

Proprietary - All rights reserved.
