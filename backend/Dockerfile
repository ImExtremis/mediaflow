FROM node:20-alpine

WORKDIR /app

# Install dependencies first (caching layer)
RUN apk add --no-cache docker-cli
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Config directory (mounted as volume)
RUN mkdir -p /app/config

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
