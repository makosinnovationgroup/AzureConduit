# Salesforce MCP Server

A Model Context Protocol (MCP) server for Salesforce CRM integration using JSForce. This server provides tools for accessing Salesforce accounts, opportunities, contacts, and cases.

## Features

- **Account Management**: List, search, and retrieve Salesforce accounts
- **Opportunity Tracking**: List opportunities, get details, and view pipeline summaries
- **Contact Management**: List, search, and retrieve contacts
- **Case Support**: List and retrieve support cases with filtering

## Prerequisites

- Node.js 18+
- Salesforce org (Production or Sandbox)
- Salesforce Connected App with OAuth2 configured

## Salesforce Connected App Setup

### Step 1: Create a Connected App

1. Log in to Salesforce Setup
2. Navigate to **Setup > Apps > App Manager**
3. Click **New Connected App**
4. Fill in the required fields:
   - **Connected App Name**: `MCP Server`
   - **API Name**: `MCP_Server`
   - **Contact Email**: Your email address

### Step 2: Configure OAuth Settings

1. Check **Enable OAuth Settings**
2. Set **Callback URL**: `https://login.salesforce.com/services/oauth2/callback` (or your custom callback)
3. Select the following **OAuth Scopes**:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - `Access your basic information (id, profile, email, address, phone)`
4. Uncheck **Require Secret for Web Server Flow** if using password flow
5. Check **Require Secret for Refresh Token Flow**

### Step 3: Get Consumer Credentials

1. After saving, click **Manage Consumer Details**
2. Verify your identity (you may need to verify via email/authenticator)
3. Copy the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)

### Step 4: Configure IP Relaxation (Optional but Recommended for Development)

1. Go to **Manage** on your Connected App
2. Click **Edit Policies**
3. Under **OAuth Policies**, set **IP Relaxation** to `Relax IP restrictions`

### Step 5: Security Token

If your org has IP restrictions enabled, append your security token to your password:
- Find your security token: **User Settings > Reset My Security Token**
- Password format: `yourpassword` + `securitytoken`

## Required Salesforce Permissions

The user connecting to Salesforce needs these permissions:

### Object Permissions (Read access required)
- Accounts
- Contacts
- Opportunities
- Cases

### System Permissions
- API Enabled
- View All Data (optional, for full access across the org)

### Profile/Permission Set Setup
1. Create or edit a Permission Set
2. Enable **API Enabled** under System Permissions
3. Grant **Read** access to Account, Contact, Opportunity, and Case objects
4. Assign the Permission Set to your integration user

## Installation

```bash
# Clone the repository
cd salesforce-mcp

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your Salesforce credentials
```

## Configuration

Create a `.env` file with the following variables:

```env
# Salesforce OAuth2 Configuration
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_USERNAME=your_salesforce_username
SF_PASSWORD=your_salesforce_password_with_security_token

# Server Configuration
PORT=8000
LOG_LEVEL=info
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SF_LOGIN_URL` | Salesforce login URL (`https://login.salesforce.com` for production, `https://test.salesforce.com` for sandbox) | Yes |
| `SF_CLIENT_ID` | Connected App Consumer Key | Yes |
| `SF_CLIENT_SECRET` | Connected App Consumer Secret | Yes |
| `SF_USERNAME` | Salesforce username | Yes |
| `SF_PASSWORD` | Salesforce password + security token | Yes |
| `PORT` | HTTP server port for health checks | No (default: 8000) |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | No (default: info) |

## Usage

### Development

```bash
# Run in development mode
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start the server
npm start
```

### Docker

```bash
# Build the image
docker build -t salesforce-mcp .

# Run the container
docker run -p 8000:8000 --env-file .env salesforce-mcp
```

## Available Tools

### Account Tools

#### `list_accounts`
List Salesforce accounts with optional filters.

**Parameters:**
- `limit` (number, optional): Maximum accounts to return (1-200, default: 50)
- `industry` (string, optional): Filter by industry
- `type` (string, optional): Filter by account type

#### `get_account`
Get detailed information about a specific account.

**Parameters:**
- `account_id` (string, required): Salesforce Account ID

#### `search_accounts`
Search for accounts by name using full-text search.

**Parameters:**
- `search_term` (string, required): Search term for account name

### Opportunity Tools

#### `list_opportunities`
List Salesforce opportunities with optional filters.

**Parameters:**
- `limit` (number, optional): Maximum opportunities to return (1-200, default: 50)
- `stage` (string, optional): Filter by opportunity stage
- `owner_email` (string, optional): Filter by owner email

#### `get_opportunity`
Get detailed information about a specific opportunity.

**Parameters:**
- `opportunity_id` (string, required): Salesforce Opportunity ID

#### `get_pipeline_summary`
Get a summary of the sales pipeline grouped by stage.

**Parameters:** None

**Returns:**
- Stage-by-stage breakdown with counts and amounts
- Total pipeline value
- Weighted pipeline value (by probability)

### Contact Tools

#### `list_contacts`
List Salesforce contacts with optional filter by account.

**Parameters:**
- `limit` (number, optional): Maximum contacts to return (1-200, default: 50)
- `account_id` (string, optional): Filter by Account ID

#### `get_contact`
Get detailed information about a specific contact.

**Parameters:**
- `contact_id` (string, required): Salesforce Contact ID

#### `search_contacts`
Search for contacts by name or email.

**Parameters:**
- `search_term` (string, required): Search term for contact name or email

### Case Tools

#### `list_cases`
List Salesforce support cases with optional filters.

**Parameters:**
- `status` (string, optional): Filter by case status
- `priority` (string, optional): Filter by case priority
- `account_id` (string, optional): Filter by Account ID

#### `get_case`
Get detailed information about a specific case.

**Parameters:**
- `case_id` (string, required): Salesforce Case ID

## Health Check

The server exposes a health check endpoint at `GET /health` on port 8000.

**Response:**
```json
{
  "status": "healthy",
  "service": "salesforce-mcp",
  "salesforce": {
    "connected": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Troubleshooting

### Common Issues

#### "INVALID_LOGIN: Invalid username, password, security token"
- Ensure your password includes the security token appended to it
- Verify your username is correct (full email format)
- Check that the user has API access enabled

#### "INVALID_CLIENT: invalid client credentials"
- Verify your Client ID and Client Secret are correct
- Ensure the Connected App is activated
- Check IP relaxation settings

#### "UNABLE_TO_LOCK_ROW"
- This is usually a temporary Salesforce issue
- Retry the operation

#### "REQUEST_LIMIT_EXCEEDED"
- You've hit Salesforce API limits
- Implement rate limiting or upgrade your Salesforce edition

### Debug Mode

Set `LOG_LEVEL=debug` in your `.env` file for verbose logging.

## License

MIT
