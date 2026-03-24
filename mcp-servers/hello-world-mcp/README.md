# Hello World MCP Server

A minimal Model Context Protocol (MCP) server for learning the basics. This is the simplest possible MCP server implementation.

## What This Server Does

This server exposes two simple tools:

| Tool | Description | Parameters |
|------|-------------|------------|
| `hello_world` | Returns "Hello, World!" | None |
| `echo` | Returns whatever text you send | `message` (string) |

## Project Structure

```
hello-world-mcp/
├── src/
│   ├── index.ts    # HTTP server, /health endpoint, SSE transport
│   └── server.ts   # MCP server with tool definitions
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Run Locally

### Prerequisites
- Node.js 20+
- npm

### Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build and run:
   ```bash
   npm run dev
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:8000/health
   ```

## Build and Run with Docker

1. Build the image:
   ```bash
   docker build -t hello-world-mcp .
   ```

2. Run the container:
   ```bash
   docker run -p 8000:8000 hello-world-mcp
   ```

3. Test it:
   ```bash
   curl http://localhost:8000/health
   ```

## Connect an MCP Client

This server uses Server-Sent Events (SSE) transport. To connect:

- **SSE Endpoint:** `http://localhost:8000/sse`
- **Messages Endpoint:** `http://localhost:8000/messages`

## Key Concepts

### MCP Server Creation
```typescript
const server = new McpServer({
  name: "hello-world-mcp",
  version: "1.0.0",
});
```

### Defining a Tool (no parameters)
```typescript
server.tool(
  "hello_world",                              // Tool name
  "Returns a greeting",                       // Description
  {},                                         // No parameters
  async () => ({                              // Handler
    content: [{ type: "text", text: "Hello, World!" }],
  })
);
```

### Defining a Tool (with parameters)
```typescript
server.tool(
  "echo",                                     // Tool name
  "Echoes back the message",                  // Description
  { message: z.string() },                    // Parameters (Zod schema)
  async ({ message }) => ({                   // Handler
    content: [{ type: "text", text: message }],
  })
);
```

## Next Steps

Once you understand this example, explore:
- Adding more complex tools with multiple parameters
- Adding resources and prompts
- Adding authentication
- Connecting to external APIs or databases
