# Multi-stage build for Vite React application

# Stage 1: Builder stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install git and pnpm
RUN apk add --no-cache git && \
    corepack enable && \
    corepack prepare pnpm@9 --activate

# Copy package files first for better layer caching
COPY package*.json ./

# Copy external dependencies
COPY external ./external

# Install main dependencies
RUN npm ci --legacy-peer-deps

# Build external packages using pnpm workspaces
# Disable interactive prompts
ENV CI=true

# Build cmdk using pnpm filter command from workspace root
WORKDIR /app/external/cmdk
RUN pnpm install && \
    pnpm rebuild esbuild && \
    pnpm -F cmdk build

# Build number-flow packages using pnpm filter from workspace root
WORKDIR /app/external/number-flow
RUN pnpm install --no-frozen-lockfile && \
    pnpm rebuild esbuild && \
    pnpm -F number-flow build && \
    pnpm -F @number-flow/react build

# Return to app root
WORKDIR /app

# Copy TypeScript configuration files
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY components.json ./
COPY index.html ./

# Copy source code and public assets
COPY src ./src
COPY public ./public

# Build the application
RUN npm run build

# Stage 2: Production stage with Node.js
FROM node:24-alpine AS runner

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy server.js from docker directory
COPY --chown=nodejs:nodejs docker/server.js ./server.js

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the server
CMD ["node", "server.js"]
