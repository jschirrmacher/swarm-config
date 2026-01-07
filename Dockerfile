FROM node:24-alpine AS builder

WORKDIR /app

# Copy entire project first (needed for postinstall hooks)
COPY . .

# Install all dependencies
RUN npm ci

# Build web-ui application
RUN npm run build

# Production stage
FROM node:24-alpine

# Install system dependencies including Docker CLI and OpenSSH client for ssh-keygen
RUN apk add --no-cache wget git docker-cli openssh-client

WORKDIR /app

# Copy built application (includes all server utilities and API endpoints)
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
