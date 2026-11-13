FROM oven/bun:1 AS base
WORKDIR /app

# Copy the mini-service files.
COPY package.json ./
COPY index.ts ./

# Install dependencies.
RUN bun install --frozen-lockfile || bun install

# Expose the socket.io port (gateway-facing) and the internal HTTP port.
EXPOSE 3003 3004

# Health check — the HTTP endpoint on port 3004.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1

# Run the service (no --hot in production).
CMD ["bun", "index.ts"]
