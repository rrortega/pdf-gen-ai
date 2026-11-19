# Puppeteer 25 requires Node >=22.12 and manages its own compatible Chrome for Testing.
FROM node:22-slim

# Chrome for Testing still needs the runtime shared libraries, but the binary is
# downloaded by Puppeteer into /app/.cache/puppeteer during npm ci.
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# The Puppeteer config must be present before its install script downloads the
# Chrome for Testing revision pinned by the Puppeteer package.
COPY package*.json .puppeteerrc.cjs ./
RUN npm ci --include=dev

COPY . .

ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
