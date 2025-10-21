FROM ghcr.io/puppeteer/puppeteer:22.15.0

WORKDIR /app

# Install deps first for better cache
COPY package*.json ./
# Use npm ci if lockfile exists, otherwise fallback to npm install
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
			npm ci --omit=dev; \
		else \
			npm install --omit=dev; \
		fi

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
