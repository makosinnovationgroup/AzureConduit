# IT Assets MCP Server

A Model Context Protocol (MCP) server for IT asset management via Microsoft Intune and Entra ID (Azure AD). This server provides pre-built reports and curated IT operations KPIs.

## Overview

This MCP server wraps the Microsoft Graph API to provide easy access to:

- **Device Management** - Intune managed devices, compliance, and sync status
- **Compliance Reporting** - Policy compliance, issues, and trends
- **Security Posture** - Encryption, OS currency, and risk assessment
- **License Management** - Usage, costs, and optimization opportunities
- **User Management** - Device assignments, MFA status, and activity

## Prerequisites

### Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com) > Azure Active Directory > App registrations
2. Click "New registration"
3. Name your app (e.g., "IT Assets MCP Server")
4. Select "Accounts in this organizational directory only"
5. Click "Register"

### Required API Permissions

Add the following **Application permissions** (not Delegated):

#### Microsoft Graph

| Permission | Type | Description |
|------------|------|-------------|
| `DeviceManagementManagedDevices.Read.All` | Application | Read Microsoft Intune devices |
| `DeviceManagementConfiguration.Read.All` | Application | Read device configuration and policies |
| `Device.Read.All` | Application | Read all devices |
| `User.Read.All` | Application | Read all users' full profiles |
| `Directory.Read.All` | Application | Read directory data |
| `Organization.Read.All` | Application | Read organization information |
| `AuditLog.Read.All` | Application | Read audit log data (for sign-in activity) |
| `UserAuthenticationMethod.Read.All` | Application | Read users' authentication methods (for MFA check) |

### Grant Admin Consent

After adding permissions, click "Grant admin consent for [Your Organization]" to authorize the app.

### Create Client Secret

1. Go to "Certificates & secrets"
2. Click "New client secret"
3. Set a description and expiration
4. Copy the secret value immediately (you won't see it again)

## Installation

```bash
cd /path/to/it-assets-mcp
npm install
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
PORT=8000
LOG_LEVEL=info
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## Docker

```bash
# Build
docker build -t it-assets-mcp .

# Run
docker run -p 8000:8000 \
  -e AZURE_TENANT_ID=your-tenant-id \
  -e AZURE_CLIENT_ID=your-client-id \
  -e AZURE_CLIENT_SECRET=your-client-secret \
  it-assets-mcp
```

## Available Tools

### Device Management

| Tool | Description |
|------|-------------|
| `get_device_summary` | Total devices by OS, compliance status, and management state |
| `list_devices` | List devices with filters for OS, compliance, and user |
| `get_device` | Get detailed device information by ID |
| `get_noncompliant_devices` | All non-compliant devices with failure reasons |
| `get_stale_devices` | Devices not synced in N days |

### Compliance

| Tool | Description |
|------|-------------|
| `get_compliance_summary` | Overall compliance percentage and counts |
| `get_compliance_by_policy` | Compliance breakdown by each policy |
| `get_compliance_trend` | Compliance over time (requires historical data infrastructure) |
| `get_compliance_issues` | Top compliance issues ranked by severity |

### Security

| Tool | Description |
|------|-------------|
| `get_security_posture` | Overall security score with risk categories |
| `get_devices_without_encryption` | Unencrypted devices |
| `get_outdated_os` | Devices with outdated OS versions |
| `get_risky_devices` | Devices with multiple security risk factors |

### Licenses

| Tool | Description |
|------|-------------|
| `get_license_summary` | License usage and utilization by type |
| `get_unused_licenses` | Licenses assigned to inactive users |
| `get_license_costs` | Estimated license costs by type |

### Users

| Tool | Description |
|------|-------------|
| `get_user_devices` | Devices assigned to a specific user |
| `get_users_without_mfa` | Users without MFA enabled |
| `get_inactive_users` | Users with no recent sign-in activity |

## IT Admin Use Cases

### Security Dashboard
```
- get_security_posture (overall score)
- get_compliance_summary (compliance %)
- get_users_without_mfa (MFA coverage)
```

### Device Fleet Management
```
- get_device_summary (inventory overview)
- get_stale_devices days=30 (inactive devices)
- get_noncompliant_devices (remediation queue)
```

### License Optimization
```
- get_license_summary (utilization)
- get_unused_licenses days_inactive=60 (waste)
- get_license_costs (budget planning)
```

### User Offboarding Prep
```
- get_user_devices user_email="user@company.com"
- get_inactive_users days_inactive=90 (candidates)
```

### Compliance Audit
```
- get_compliance_by_policy (policy effectiveness)
- get_compliance_issues limit=50 (remediation priority)
- get_devices_without_encryption (critical gaps)
```

## Health Endpoints

- `GET /health` - Basic health check (connector status)
- `GET /ready` - Readiness check (API connectivity)

## Security Considerations

1. **Least Privilege**: Only request necessary Graph API permissions
2. **Secret Rotation**: Rotate client secrets regularly
3. **Audit Logging**: All tool calls are logged with timestamps
4. **Network Security**: Deploy behind a firewall/VPN for production
5. **Data Sensitivity**: Device and user data is sensitive - ensure proper access controls

## Troubleshooting

### Connection Errors
- Verify tenant ID, client ID, and secret are correct
- Ensure admin consent was granted for all permissions
- Check if the app registration is not expired

### Empty Results
- Verify Intune is set up and has managed devices
- Check if the app has correct permissions
- Some features require Intune P1/P2 licensing

### Rate Limiting
- Microsoft Graph has rate limits
- Implement caching for high-frequency queries
- Consider using batch requests for large operations

## License Pricing Notes

The license cost estimates in `get_license_costs` are based on standard Microsoft pricing and may not reflect your actual contract pricing. Update the `licensePricing` map in `license-tools.ts` with your actual rates for accurate cost analysis.
