FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install all dependencies (skip postinstall hooks for Docker build)
RUN npm ci --ignore-scripts

# Copy entire project (including web-ui)
COPY . .

# Build web-ui application
RUN npm run ui:build

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.output /app/.output

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/api/repositories', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run application
CMD ["node", ".output/server/index.mjs"]
