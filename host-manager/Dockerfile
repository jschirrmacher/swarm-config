FROM node:20-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY index.js .

# Expose port
EXPOSE 3001

# Run as root (needed for Docker socket access)
USER root

CMD ["node", "index.js"]
