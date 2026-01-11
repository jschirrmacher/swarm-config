FROM node:24-alpine AS builder

WORKDIR /app
RUN npm install -g npm@latest

COPY . .
RUN npm ci && npm run build

# Production stage
FROM node:24-alpine

RUN apk add --no-cache wget git docker-cli openssh-client

WORKDIR /app
COPY --from=builder /app/.output /app/.output

ENV NODE_ENV=production \
  PORT=3000 \
  HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run application
CMD ["node", ".output/server/index.mjs"]
