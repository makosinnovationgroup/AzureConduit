# Patient Portal MCP Server Dockerfile
#
# HIPAA SECURITY NOTES:
# - Non-root user for container security
# - No PHI should be stored in the container image
# - Ensure secrets (API keys, credentials) are injected at runtime via env vars
# - Use with a reverse proxy (nginx, Traefik) for TLS termination
# - Container logs may contain audit data - ensure proper log management

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security (HIPAA: principle of least privilege)
RUN addgroup -g 1001 -S mcpgroup && \
    adduser -S mcpuser -u 1001 -G mcpgroup

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R mcpuser:mcpgroup /app

# Switch to non-root user
USER mcpuser

# Expose port
EXPOSE 8000

# Set environment variables
ENV PORT=8000
ENV NODE_ENV=production

# Health check
# NOTE: Health endpoint does not expose PHI
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Labels for container identification
LABEL org.opencontainers.image.title="Patient Portal MCP Server"
LABEL org.opencontainers.image.description="HIPAA-compliant MCP server for patient portal integration"
LABEL org.opencontainers.image.vendor="AzureConduit"
LABEL org.opencontainers.image.version="1.0.0"
LABEL hipaa.compliant="true"
LABEL hipaa.audit-logging="enabled"

# Start the server
CMD ["node", "dist/index.js"]
