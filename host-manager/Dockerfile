FROM node:24-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY lib/ ./lib/
COPY commands/ ./commands/
COPY index.ts ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3001

# Run as root (needed for Docker socket access)
USER root

CMD ["node", "dist/index.js"]
