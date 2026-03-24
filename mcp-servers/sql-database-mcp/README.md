# SQL Database MCP Server

A Model Context Protocol (MCP) server that connects to SQL Server, PostgreSQL, or MySQL databases and exposes query tools for safe, read-only database interactions.

## Features

- **Multi-database support**: Connect to SQL Server (mssql), PostgreSQL (pg), or MySQL (mysql2)
- **Connection pooling**: Efficient connection management for all database types
- **Read-only operations**: Only SELECT queries are allowed for safety
- **MCP tools**:
  - `list_tables` - List all tables in the database
  - `describe_table` - Get schema information for a specific table
  - `run_query` - Execute SELECT queries (validates query safety)
  - `get_sample_data` - Get sample rows from a table

## Security

This server is designed for read-only database access:
- Only SELECT queries are allowed
- INSERT, UPDATE, DELETE, DROP, and other modifying statements are rejected
- Table names are validated to prevent SQL injection
- Connection credentials are never logged

## Prerequisites

- Node.js 20 or later
- npm or yarn
- Access to a SQL Server, PostgreSQL, or MySQL database

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_TYPE` | Database type: `mssql`, `postgres`, or `mysql` | `postgres` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `mydb` |
| `DB_USER` | Database username | `myuser` |
| `DB_PASSWORD` | Database password | - |
| `DB_POOL_MIN` | Minimum pool connections | `2` |
| `DB_POOL_MAX` | Maximum pool connections | `10` |
| `PORT` | HTTP server port | `8000` |

### Database-Specific Configuration

#### PostgreSQL

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=your_password
```

#### SQL Server

```env
DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1433
DB_NAME=mydb
DB_USER=sa
DB_PASSWORD=your_password
```

#### MySQL

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mydb
DB_USER=root
DB_PASSWORD=your_password
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
docker build -t sql-database-mcp .

# Run the container
docker run -p 8000:8000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=mydb \
  -e DB_USER=myuser \
  -e DB_PASSWORD=mypassword \
  sql-database-mcp
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the server and database connection.

**Response:**
```json
{
  "status": "healthy",
  "service": "sql-database-mcp",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": {
    "type": "postgres",
    "host": "localhost",
    "database": "mydb",
    "connected": true
  }
}
```

### SSE (Server-Sent Events)

```
GET /sse
```

MCP communication endpoint using Server-Sent Events.

## MCP Tools

### list_tables

Lists all tables in the connected database.

**Parameters:** None

**Returns:**
```json
{
  "tables": [
    {
      "name": "users",
      "schema": "public",
      "type": "BASE TABLE"
    }
  ]
}
```

### describe_table

Gets the schema/structure of a specific table.

**Parameters:**
- `table_name` (required): The name of the table to describe

**Returns:**
```json
{
  "table_name": "users",
  "columns": [
    {
      "name": "id",
      "type": "integer",
      "nullable": false,
      "default_value": "nextval('users_id_seq'::regclass)",
      "max_length": null
    },
    {
      "name": "email",
      "type": "character varying",
      "nullable": false,
      "default_value": null,
      "max_length": 255
    }
  ]
}
```

### run_query

Executes a SELECT query against the database.

**Parameters:**
- `query` (required): The SELECT query to execute

**Returns:**
```json
{
  "query": "SELECT id, email FROM users LIMIT 5",
  "row_count": 5,
  "rows": [
    {"id": 1, "email": "user1@example.com"},
    {"id": 2, "email": "user2@example.com"}
  ]
}
```

**Note:** Only SELECT queries are allowed. Any attempt to run INSERT, UPDATE, DELETE, or other modifying statements will be rejected.

### get_sample_data

Gets sample rows from a table.

**Parameters:**
- `table_name` (required): The name of the table
- `limit` (optional): Maximum number of rows (1-1000, default: 10)

**Returns:**
```json
{
  "table_name": "users",
  "limit": 10,
  "row_count": 5,
  "rows": [
    {"id": 1, "email": "user1@example.com", "created_at": "2024-01-01T00:00:00.000Z"}
  ]
}
```

## MCP Client Configuration

To use this server with an MCP client, add it to your client configuration:

```json
{
  "mcpServers": {
    "sql-database": {
      "url": "http://localhost:8000/sse"
    }
  }
}
```

## Troubleshooting

### Connection Issues

1. Verify your database is running and accessible
2. Check that the credentials in `.env` are correct
3. Ensure the database port is not blocked by a firewall
4. For Docker, use `host.docker.internal` to connect to the host machine

### Query Errors

1. Ensure your query is a valid SELECT statement
2. Check that table and column names are correct
3. Verify you have read permissions on the tables

## License

MIT
