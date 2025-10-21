FROM ghcr.io/puppeteer/puppeteer:22.15.0

WORKDIR /app

# Install deps first for better cache
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
