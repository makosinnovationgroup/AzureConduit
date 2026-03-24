# Employee 360 MCP Server

A cross-system MCP (Model Context Protocol) server that aggregates HR, IT, and directory data to provide complete employee views. This server connects to multiple enterprise systems and presents a unified API for employee information.

## Overview

The Employee 360 MCP server acts as an aggregation layer across:

- **HR Systems** - BambooHR, Workday, or custom HR APIs
- **Directory Services** - Azure AD / Entra ID via Microsoft Graph
- **IT Asset Management** - Microsoft Intune or ServiceNow CMDB

This enables AI assistants and automation tools to get comprehensive employee information from a single source.

## Use Cases

### Employee Onboarding
- Verify new hire setup across all systems
- Check that AD account, devices, and app access are provisioned
- Confirm HR records match directory information

### Employee Offboarding
- Generate complete list of employee's assets and access
- Identify all applications that need deprovisioning
- Verify termination is reflected across systems

### Security & Compliance Audits
- Review employee device compliance status
- Check for risky sign-in activity
- Verify appropriate access levels for role

### IT Support
- Quickly retrieve employee's assigned devices
- Check device health and compliance
- View application access for troubleshooting

### Management Reporting
- Get org chart views
- List team members by manager or department
- Review PTO balances and tenure

## Tools

### Cross-System Tools

| Tool | Description |
|------|-------------|
| `get_employee_360` | Complete 360 view aggregating HR, directory, devices, access, and activity |
| `search_employees` | Search across HR and directory systems simultaneously |
| `get_org_chart` | Get reporting structure from a manager with configurable depth |

### HR Tools

| Tool | Description |
|------|-------------|
| `get_employee_hr` | HR details: title, department, hire date, PTO balance, tenure |
| `get_direct_reports` | List all direct reports for a manager |
| `get_team_members` | List team/department members |

### IT Tools

| Tool | Description |
|------|-------------|
| `get_employee_devices` | All assigned devices with health scores |
| `get_employee_access` | Applications and systems with access levels |
| `get_device_compliance` | Compliance status and policy violations |

### Activity Tools

| Tool | Description |
|------|-------------|
| `get_recent_activity` | Recent sign-ins, audit events, and security alerts |

## Setup

### Prerequisites

- Node.js 20+
- Azure AD app registration with appropriate permissions
- HR system API access (BambooHR, Workday, or custom)
- Optional: ServiceNow instance for CMDB integration

### Installation

```bash
# Clone and navigate to the server
cd mcp-servers/employee-360-mcp

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Build the TypeScript
npm run build

# Start the server
npm start
```

### Azure AD App Registration

1. Go to Azure Portal > Azure Active Directory > App registrations
2. Create a new registration
3. Note the Application (client) ID and Directory (tenant) ID
4. Create a client secret
5. Add API permissions (Application permissions):
   - `User.Read.All` - Read user profiles
   - `Directory.Read.All` - Read org structure
   - `DeviceManagementManagedDevices.Read.All` - Read Intune devices
   - `AuditLog.Read.All` - Read sign-in and audit logs
   - `IdentityRiskEvent.Read.All` - Read security alerts (requires P2)
6. Grant admin consent

### HR System Setup

#### BambooHR
1. Log into BambooHR as admin
2. Go to Settings > Access > API Keys
3. Create API key with employee directory access

#### Workday
1. Register an API client in Workday
2. Configure OAuth 2.0 client credentials
3. Grant access to Worker data

### Docker Deployment

```bash
# Build the image
docker build -t employee-360-mcp .

# Run with environment variables
docker run -d \
  -p 8000:8000 \
  -e AZURE_TENANT_ID=your-tenant-id \
  -e AZURE_CLIENT_ID=your-client-id \
  -e AZURE_CLIENT_SECRET=your-client-secret \
  -e HR_SYSTEM_TYPE=bamboohr \
  -e HR_API_URL=https://api.bamboohr.com/api/gateway.php/YOUR_COMPANY \
  -e HR_API_KEY=your-api-key \
  employee-360-mcp
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 8000) | No |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Yes |
| `AZURE_CLIENT_ID` | Azure AD app client ID | Yes |
| `AZURE_CLIENT_SECRET` | Azure AD app client secret | Yes |
| `HR_SYSTEM_TYPE` | HR system type: bamboohr, workday, generic | No |
| `HR_API_URL` | HR system API base URL | Yes |
| `HR_API_KEY` | HR system API key (for BambooHR) | Depends |
| `HR_CLIENT_ID` | HR system OAuth client ID (for Workday) | Depends |
| `HR_CLIENT_SECRET` | HR system OAuth client secret | Depends |
| `IT_ASSET_SYSTEM_TYPE` | IT asset system: intune, servicenow | No |
| `SERVICENOW_URL` | ServiceNow instance URL | If using SNOW |
| `SERVICENOW_USERNAME` | ServiceNow username | If using SNOW |
| `SERVICENOW_PASSWORD` | ServiceNow password | If using SNOW |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with connector status |
| `/sse` | GET | SSE endpoint for MCP client connection |
| `/messages` | POST | Message handling for MCP protocol |

## Example Queries

### Get Complete Employee View
```
Use get_employee_360 with email john.doe@company.com
```

Returns:
- HR info (title, department, hire date, PTO)
- Manager details
- Directory info (account status, groups, last login)
- Assigned devices with health scores
- Application access list
- Recent activity summary

### Search for Employees
```
Use search_employees with query "engineering"
```

Returns employees matching the query from both HR and directory systems.

### Check Device Compliance
```
Use get_device_compliance with email john.doe@company.com
```

Returns:
- All devices with compliance status
- Policy violations
- Remediation status

## Security Considerations

- All credentials should be stored securely (environment variables, secrets manager)
- The server should run in a trusted network environment
- Consider implementing request logging for audit purposes
- Use Azure AD conditional access to restrict API access
- Regularly rotate client secrets

## Troubleshooting

### "Directory lookup failed"
- Verify Azure AD credentials
- Check that app has User.Read.All permission
- Ensure admin consent was granted

### "HR lookup failed"
- Verify HR API URL and credentials
- Check API key permissions
- For BambooHR, ensure company domain is correct

### "Device lookup failed"
- Verify DeviceManagementManagedDevices.Read.All permission
- Check that the user has devices enrolled in Intune

### "Sign-in logs not available"
- AuditLog.Read.All permission required
- May require Azure AD P1 or P2 license

## License

MIT
