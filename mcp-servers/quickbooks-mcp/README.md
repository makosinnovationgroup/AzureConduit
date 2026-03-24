# QuickBooks MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with QuickBooks Online API. This server enables AI assistants to access small business accounting data including invoices, expenses, customers, and financial reports.

## Features

### Invoice Tools
- `list_invoices` - List invoices with optional filters (status, customer, limit)
- `get_invoice` - Get detailed invoice information
- `get_overdue_invoices` - Find all invoices past their due date
- `get_ar_aging` - Get accounts receivable aging summary

### Expense Tools
- `list_expenses` - List expenses with optional filters (vendor, date range)
- `get_expense` - Get detailed expense information
- `get_expenses_by_category` - Get expenses grouped by category

### Report Tools
- `get_profit_loss` - Generate Profit & Loss statement for a date range
- `get_balance_sheet` - Generate Balance Sheet as of a specific date
- `get_cash_flow` - Generate Statement of Cash Flows

### Customer Tools
- `list_customers` - List all customers with balances
- `get_customer` - Get detailed customer information

## Prerequisites

- Node.js 20 or later
- A QuickBooks Online account
- A QuickBooks Developer account with an app configured

## QuickBooks App Setup

### 1. Create a QuickBooks App

1. Go to the [Intuit Developer Portal](https://developer.intuit.com)
2. Sign in or create an account
3. Navigate to "My Apps" and click "Create an app"
4. Select "QuickBooks Online and Payments"
5. Give your app a name and create it

### 2. Configure App Settings

1. In your app dashboard, go to "Keys & OAuth"
2. Note your **Client ID** and **Client Secret**
3. Add redirect URIs:
   - For development: `http://localhost:3000/callback`
   - For production: Your production callback URL
4. Set the required scopes:
   - `com.intuit.quickbooks.accounting` (for all accounting data)

### 3. OAuth2 Flow

QuickBooks Online uses OAuth2 for authentication. Here's how the flow works:

#### Initial Authorization

1. Direct users to the authorization URL:
   ```
   https://appcenter.intuit.com/connect/oauth2?
     client_id=YOUR_CLIENT_ID&
     response_type=code&
     scope=com.intuit.quickbooks.accounting&
     redirect_uri=YOUR_REDIRECT_URI&
     state=RANDOM_STATE
   ```

2. User authorizes your app and is redirected to your callback URL with an authorization code

3. Exchange the code for tokens:
   ```bash
   curl -X POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic BASE64(client_id:client_secret)" \
     -d "grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI"
   ```

4. Store the `refresh_token` - it's valid for 100 days and is used to obtain new access tokens

#### Token Refresh

The MCP server automatically handles token refresh using the stored refresh token. Access tokens expire after 1 hour, but the server refreshes them as needed.

### 4. Finding Your Realm ID

The Realm ID (also called Company ID) identifies your QuickBooks company:

1. Log into QuickBooks Online
2. Look at the URL: `https://app.qbo.intuit.com/app/homepage?realmId=123456789012345`
3. The number after `realmId=` is your Realm ID

## Installation

```bash
# Clone or navigate to the project
cd quickbooks-mcp

# Install dependencies
npm install

# Build the TypeScript
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
QB_CLIENT_ID=your_client_id_here
QB_CLIENT_SECRET=your_client_secret_here
QB_REALM_ID=your_realm_id_here
QB_REFRESH_TOKEN=your_refresh_token_here
QB_ENVIRONMENT=sandbox  # or 'production'
PORT=8000
LOG_LEVEL=info
```

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
# Build the image
docker build -t quickbooks-mcp .

# Run the container
docker run -p 8000:8000 \
  -e QB_CLIENT_ID=your_client_id \
  -e QB_CLIENT_SECRET=your_client_secret \
  -e QB_REALM_ID=your_realm_id \
  -e QB_REFRESH_TOKEN=your_refresh_token \
  -e QB_ENVIRONMENT=sandbox \
  quickbooks-mcp
```

## Health Check

The server exposes health check endpoints:

- `GET /health` - Returns server health status
- `GET /ready` - Returns readiness status (checks QuickBooks configuration)

## MCP Integration

### Claude Desktop Configuration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-mcp/dist/index.js"],
      "env": {
        "QB_CLIENT_ID": "your_client_id",
        "QB_CLIENT_SECRET": "your_client_secret",
        "QB_REALM_ID": "your_realm_id",
        "QB_REFRESH_TOKEN": "your_refresh_token",
        "QB_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

## API Reference

### Invoice Tools

#### list_invoices
```json
{
  "status": "open",      // optional: "open" or "paid"
  "customer_id": "123",  // optional: filter by customer
  "limit": 50            // optional: max results (default: 100)
}
```

#### get_invoice
```json
{
  "invoice_id": "123"    // required: QuickBooks invoice ID
}
```

### Expense Tools

#### list_expenses
```json
{
  "vendor_id": "456",       // optional: filter by vendor
  "date_from": "2024-01-01", // optional: start date
  "date_to": "2024-12-31"    // optional: end date
}
```

### Report Tools

#### get_profit_loss
```json
{
  "start_date": "2024-01-01",  // required
  "end_date": "2024-12-31"     // required
}
```

#### get_balance_sheet
```json
{
  "as_of_date": "2024-12-31"   // required
}
```

### Customer Tools

#### list_customers
No parameters required.

#### get_customer
```json
{
  "customer_id": "789"   // required: QuickBooks customer ID
}
```

## Sandbox Testing

QuickBooks provides a sandbox environment for testing:

1. In the Developer Portal, go to your app's "Sandbox" section
2. Create sandbox companies with sample data
3. Use `QB_ENVIRONMENT=sandbox` in your configuration

## Security Considerations

- Never commit `.env` files or credentials to version control
- Store refresh tokens securely (consider using a secrets manager)
- Rotate refresh tokens periodically
- Use environment-specific credentials (sandbox vs production)
- The server runs as a non-root user in Docker for security

## Troubleshooting

### "Missing required QuickBooks configuration"
Ensure all required environment variables are set in your `.env` file.

### "Failed to refresh access token"
Your refresh token may have expired (after 100 days of inactivity). Re-authenticate through the OAuth flow.

### "Invalid grant"
The authorization code or refresh token is invalid. Obtain new credentials through the OAuth flow.

## License

MIT
