# REST API MCP Server

A generic, flexible MCP (Model Context Protocol) server that connects to any REST API and exposes tools for calling endpoints. This server acts as a bridge between AI assistants and external REST APIs.

## Features

- **Multiple Authentication Types**: Supports no auth, API key, Bearer token, Basic auth, and OAuth2 (client credentials)
- **Flexible Endpoint Configuration**: Define endpoints in a JSON configuration file
- **Direct Request Tools**: Make GET, POST, PUT, PATCH, DELETE requests to any path
- **Named Endpoint Tools**: Call pre-configured endpoints by name with parameter validation
- **Custom Headers**: Support for custom headers at both client and endpoint level
- **Comprehensive Logging**: Winston-based logging with configurable log levels

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure the server**:
   ```bash
   cp .env.example .env
   # Edit .env with your API configuration

   cp config/endpoints.example.json config/endpoints.json
   # Edit config/endpoints.json with your API endpoints
   ```

3. **Build and run**:
   ```bash
   npm run build
   npm start
   ```

4. **Development mode**:
   ```bash
   npm run dev
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes | Base URL for the REST API (e.g., `https://api.example.com`) |
| `API_AUTH_TYPE` | No | Authentication type: `none`, `api-key`, `bearer`, `basic`, `oauth2` (default: `none`) |
| `API_KEY` | If api-key auth | API key value |
| `API_KEY_HEADER` | No | Header name for API key (default: `X-API-Key`) |
| `API_TOKEN` | If bearer auth | Bearer token value |
| `API_BASIC_USERNAME` | If basic auth | Username for basic authentication |
| `API_BASIC_PASSWORD` | If basic auth | Password for basic authentication |
| `OAUTH2_CLIENT_ID` | If oauth2 auth | OAuth2 client ID |
| `OAUTH2_CLIENT_SECRET` | If oauth2 auth | OAuth2 client secret |
| `OAUTH2_TOKEN_URL` | If oauth2 auth | OAuth2 token endpoint URL |
| `OAUTH2_SCOPE` | No | OAuth2 scopes (space-separated) |
| `API_CUSTOM_HEADERS` | No | JSON object of custom headers |
| `PORT` | No | Server port (default: `8000`) |
| `LOG_LEVEL` | No | Logging level: `debug`, `info`, `warn`, `error` (default: `info`) |
| `ENDPOINTS_CONFIG_PATH` | No | Path to endpoints config file (default: `config/endpoints.json`) |

### Authentication Examples

**API Key Authentication**:
```env
API_BASE_URL=https://api.example.com
API_AUTH_TYPE=api-key
API_KEY=your-secret-api-key
API_KEY_HEADER=X-API-Key
```

**Bearer Token Authentication**:
```env
API_BASE_URL=https://api.example.com
API_AUTH_TYPE=bearer
API_TOKEN=your-bearer-token
```

**Basic Authentication**:
```env
API_BASE_URL=https://api.example.com
API_AUTH_TYPE=basic
API_BASIC_USERNAME=myuser
API_BASIC_PASSWORD=mypassword
```

**OAuth2 (Client Credentials)**:
```env
API_BASE_URL=https://api.example.com
API_AUTH_TYPE=oauth2
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret
OAUTH2_TOKEN_URL=https://auth.example.com/oauth/token
OAUTH2_SCOPE=read write
```

### Endpoints Configuration

Define your API endpoints in `config/endpoints.json`:

```json
{
  "version": "1.0.0",
  "endpoints": [
    {
      "name": "list_users",
      "description": "Get a list of all users",
      "method": "GET",
      "path": "/users",
      "parameters": [
        {
          "name": "page",
          "location": "query",
          "required": false,
          "type": "number",
          "description": "Page number",
          "default": 1
        }
      ]
    },
    {
      "name": "get_user",
      "description": "Get a user by ID",
      "method": "GET",
      "path": "/users/{id}",
      "parameters": [
        {
          "name": "id",
          "location": "path",
          "required": true,
          "type": "string",
          "description": "User ID"
        }
      ]
    },
    {
      "name": "create_user",
      "description": "Create a new user",
      "method": "POST",
      "path": "/users",
      "parameters": [
        {
          "name": "name",
          "location": "body",
          "required": true,
          "type": "string"
        },
        {
          "name": "email",
          "location": "body",
          "required": true,
          "type": "string"
        }
      ]
    }
  ]
}
```

#### Parameter Locations

- `path`: URL path parameter (e.g., `/users/{id}`)
- `query`: Query string parameter (e.g., `/users?page=1`)
- `body`: Request body field
- `header`: Request header

#### Parameter Types

- `string`
- `number`
- `boolean`
- `object`
- `array`

## Available Tools

### `list_endpoints`

List all configured endpoints from the configuration file.

**Parameters**: None

**Example Response**:
```json
{
  "total": 3,
  "endpoints": [
    {
      "name": "list_users",
      "description": "Get a list of all users",
      "method": "GET",
      "path": "/users",
      "parameters": [...]
    }
  ]
}
```

### `call_endpoint`

Call a named endpoint from the configuration.

**Parameters**:
- `endpoint_name` (string, required): Name of the endpoint to call
- `path_params` (object, optional): Path parameters (e.g., `{"id": "123"}`)
- `query_params` (object, optional): Query parameters
- `body` (any, optional): Request body

**Example**:
```json
{
  "endpoint_name": "get_user",
  "path_params": {"id": "123"}
}
```

### `get_request`

Make a GET request to any path.

**Parameters**:
- `path` (string, required): API path (e.g., `/users`)
- `query_params` (object, optional): Query parameters

### `post_request`

Make a POST request to any path.

**Parameters**:
- `path` (string, required): API path
- `body` (any, required): Request body

### `put_request`

Make a PUT request to any path.

**Parameters**:
- `path` (string, required): API path
- `body` (any, required): Request body

### `patch_request`

Make a PATCH request to any path.

**Parameters**:
- `path` (string, required): API path
- `body` (any, required): Request body

### `delete_request`

Make a DELETE request to any path.

**Parameters**:
- `path` (string, required): API path

## HTTP Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check endpoint |
| `GET /sse` | SSE endpoint for MCP communication |
| `POST /messages` | Message handling for SSE transport |
| `GET /config` | View current configuration (secrets hidden) |

## Docker

Build and run with Docker:

```bash
# Build the image
docker build -t rest-api-mcp .

# Run with environment variables
docker run -d \
  -p 8000:8000 \
  -e API_BASE_URL=https://api.example.com \
  -e API_AUTH_TYPE=bearer \
  -e API_TOKEN=your-token \
  -v $(pwd)/config:/app/config \
  rest-api-mcp
```

## Response Format

All tools return responses in the following format:

**Success**:
```json
{
  "status": 200,
  "statusText": "OK",
  "data": { ... }
}
```

**Error**:
```json
{
  "error": true,
  "status": 404,
  "statusText": "Not Found",
  "data": { ... }
}
```

## Integration with MCP Clients

Configure your MCP client to connect to this server:

```json
{
  "mcpServers": {
    "rest-api": {
      "url": "http://localhost:8000/sse"
    }
  }
}
```

## Project Structure

```
rest-api-mcp/
├── src/
│   ├── index.ts           # Entry point with HTTP server
│   ├── server.ts          # MCP server setup
│   ├── connectors/
│   │   └── rest-client.ts # Axios-based REST client
│   ├── tools/
│   │   └── api-tools.ts   # MCP tool definitions
│   └── config/
│       └── endpoints.ts   # Endpoint schema and config manager
├── config/
│   └── endpoints.example.json
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

## License

MIT
