FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install all dependencies (skip postinstall hooks for Docker build)
RUN npm ci --ignore-scripts

# Copy entire project (including web-ui)
COPY . .

# Build web-ui application
RUN npm run build

# Production stage
FROM node:24-alpine

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Copy built application
COPY --from=builder /app/.output /app/.output

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Health check - simple HTTP check that the server is responding
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run application
CMD ["node", ".output/server/index.mjs"]
