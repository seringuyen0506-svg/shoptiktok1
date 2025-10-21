# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=false \
    PUPPETEER_PRODUCT=chrome

# Install system dependencies required by Chromium (Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxfixes3 \
    libxrender1 \
    libxshmfence1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (leverage Docker layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Ensure data directory exists (ephemeral on Render unless Disk is attached)
RUN mkdir -p backend/data

# Render provides PORT; Express reads it via process.env.PORT
ENV PORT=5000
EXPOSE 5000

# Start the server
CMD ["node", "index.js"]
