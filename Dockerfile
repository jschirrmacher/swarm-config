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

# Install system dependencies
RUN apk add --no-cache wget git

WORKDIR /app

# Copy package files and install node dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy all application files (combined in one layer)
COPY --from=builder /app/.output /app/.output
COPY src ./src
COPY config ./config
COPY types ./types

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
