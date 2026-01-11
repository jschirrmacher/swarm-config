FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g npm@latest

COPY package*.json tsconfig.json ./
RUN npm install

COPY lib/ ./lib/
COPY commands/ ./commands/
COPY index.ts ./

RUN npm run build

# Production stage
FROM node:24-alpine

RUN apk add --no-cache docker-cli && \
  npm install -g npm@latest

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001
USER root

CMD ["node", "dist/index.js"]
