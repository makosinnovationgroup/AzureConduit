# HubSpot MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with HubSpot CRM and Marketing APIs.

## Features

### CRM Tools

#### Contact Tools
- **list_contacts** - List contacts with optional filtering by lifecycle stage
- **get_contact** - Get detailed contact information by ID or email
- **search_contacts** - Search contacts by name, email, company, or other fields

#### Deal Tools
- **list_deals** - List deals with optional filtering by stage and owner
- **get_deal** - Get detailed deal information with associated contacts and companies
- **get_pipeline_summary** - Get a summary of all deals grouped by pipeline stage with total amounts

#### Company Tools
- **list_companies** - List companies from HubSpot CRM
- **get_company** - Get detailed company information with associated contacts and deals

### Marketing Tools
- **list_campaigns** - List marketing email campaigns
- **get_campaign_stats** - Get detailed campaign performance (opens, clicks, bounces, etc.)
- **list_forms** - List marketing forms with configuration details

## Setup

### Prerequisites

1. A HubSpot account with appropriate access
2. Node.js 18 or higher
3. npm or yarn

### Creating a HubSpot Private App

1. Log in to your HubSpot account
2. Navigate to **Settings** (gear icon) > **Integrations** > **Private Apps**
3. Click **Create a private app**
4. Give your app a name (e.g., "MCP Server Integration")
5. Configure the required scopes (see below)
6. Click **Create app**
7. Copy the access token that is generated

### Required Scopes

Configure the following scopes for your private app:

#### CRM Scopes
- `crm.objects.contacts.read` - Read contacts
- `crm.objects.deals.read` - Read deals
- `crm.objects.companies.read` - Read companies
- `crm.schemas.contacts.read` - Read contact schemas
- `crm.schemas.deals.read` - Read deal schemas
- `crm.schemas.companies.read` - Read company schemas

#### Marketing Scopes
- `marketing.emails.read` - Read marketing emails
- `marketing.forms.read` - Read marketing forms

#### Optional Scopes (for future expansion)
- `crm.objects.contacts.write` - Create/update contacts
- `crm.objects.deals.write` - Create/update deals
- `crm.objects.companies.write` - Create/update companies

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your HubSpot access token:
   ```
   HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   PORT=8000
   LOG_LEVEL=info
   ```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Docker

### Build the image

```bash
docker build -t hubspot-mcp .
```

### Run the container

```bash
docker run -p 8000:8000 \
  -e HUBSPOT_ACCESS_TOKEN=your_token_here \
  hubspot-mcp
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /sse` - SSE endpoint for MCP client connections
- `POST /messages` - Message handling endpoint for MCP requests

## Tool Reference

### list_contacts

List contacts from HubSpot CRM.

**Parameters:**
- `limit` (optional, number): Maximum contacts to return (default: 100)
- `lifecycle_stage` (optional, string): Filter by lifecycle stage (lead, subscriber, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, evangelist, other)

### get_contact

Get detailed contact information.

**Parameters:**
- `contact_id` (optional, string): The HubSpot contact ID
- `email` (optional, string): The contact email address

*Note: Either contact_id or email must be provided*

### search_contacts

Search contacts by text query.

**Parameters:**
- `query` (required, string): Search query to match against contact fields

### list_deals

List deals from HubSpot CRM.

**Parameters:**
- `stage` (optional, string): Filter by deal stage ID
- `owner` (optional, string): Filter by HubSpot owner ID
- `limit` (optional, number): Maximum deals to return (default: 100)

### get_deal

Get detailed deal information.

**Parameters:**
- `deal_id` (required, string): The HubSpot deal ID

### get_pipeline_summary

Get a summary of all deals grouped by pipeline stage. No parameters required.

### list_companies

List companies from HubSpot CRM.

**Parameters:**
- `limit` (optional, number): Maximum companies to return (default: 100)

### get_company

Get detailed company information.

**Parameters:**
- `company_id` (required, string): The HubSpot company ID

### list_campaigns

List marketing email campaigns. No parameters required.

### get_campaign_stats

Get detailed campaign performance statistics.

**Parameters:**
- `campaign_id` (required, string): The HubSpot marketing email/campaign ID

### list_forms

List marketing forms. No parameters required.

## Error Handling

All tools return structured error responses with `isError: true` when errors occur. Common error scenarios:

- Missing or invalid access token
- Insufficient API scopes
- Rate limiting (HubSpot API limits)
- Invalid object IDs
- Network connectivity issues

## Rate Limits

HubSpot API has rate limits that vary by subscription tier:
- Free/Starter: 100 requests per 10 seconds
- Professional: 150 requests per 10 seconds
- Enterprise: 200 requests per 10 seconds

The server handles rate limiting gracefully but does not implement automatic retry logic.

## License

MIT
