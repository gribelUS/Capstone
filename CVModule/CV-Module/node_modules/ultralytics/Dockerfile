# Multi-architecture Dockerfile for Ultralytics
# Supports both AMD64 and ARM64 (Apple Silicon, AWS Graviton, etc.)
# Optimized for Docker build cache efficiency

# ============================================
# Stage 1: Dependencies
# This stage is cached unless package*.json changes
# ============================================
FROM --platform=$BUILDPLATFORM node:18-alpine AS deps

WORKDIR /app

# Copy ONLY package files first to maximize cache hits
COPY package.json package-lock.json ./

# Install ALL dependencies (dev + prod needed for build)
# Using --frozen-lockfile equivalent with npm ci
RUN npm ci

# ============================================
# Stage 2: Build
# Rebuilds only when source code changes
# ============================================
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy TypeScript config first (rarely changes)
COPY tsconfig.json ./

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build:server

# ============================================
# Stage 3: Production dependencies
# Cached separately from full dependency install
# ============================================
FROM --platform=$BUILDPLATFORM node:18-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

# Install production dependencies only
# Clean npm cache to reduce image size
RUN npm ci --omit=dev && \
    npm cache clean --force

# ============================================
# Stage 4: Production runtime
# Minimal image with only what's needed to run
# ============================================
FROM node:18-alpine AS production

# Add labels for image metadata
LABEL org.opencontainers.image.title="Ultralytics"
LABEL org.opencontainers.image.description="Self-hosted analytics server"
LABEL org.opencontainers.image.source="https://github.com/aibubba/ultralytics"

WORKDIR /app

# Create non-root user for security FIRST
# This layer is cached and rarely changes
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from prod-deps stage
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy package.json for runtime metadata
COPY --chown=nodejs:nodejs package.json ./

# Copy built files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy static assets (docs, migrations) - these change infrequently
COPY --chown=nodejs:nodejs docs ./docs
COPY --chown=nodejs:nodejs migrations ./migrations

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production

# Expose server port
EXPOSE 3000

# Health check with longer start period for cold starts
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
