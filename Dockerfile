# syntax=docker/dockerfile:1

FROM node:16-bullseye

# Use production node environment by default.
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install dependencies for Playwright and Google Chrome
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    wget \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Install Playwright browsers
RUN npx playwright install chromium --with-deps
RUN npx playwright install-deps chromium

# Find the actual path to the Chromium executable
RUN CHROMIUM_PATH=$(find /usr/src/app/node_modules/playwright/.cache/playwright -name "chrome-linux" -type d | head -n 1) && \
    if [ -n "$CHROMIUM_PATH" ]; then \
      echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$CHROMIUM_PATH/chrome" > /usr/src/app/browser_path.sh; \
    else \
      echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome-stable" > /usr/src/app/browser_path.sh; \
    fi

# Copy the rest of the source files into the image
COPY . .

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/src/app/node_modules/playwright/.cache/playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Add additional Playwright/Chromium flags for containerized environments
ENV PLAYWRIGHT_CHROMIUM_ARGS="--disable-dev-shm-usage --no-sandbox --disable-setuid-sandbox --disable-gpu"

# Expose the port that the application listens on
EXPOSE 8080

# Use node directly to run the application with the correct browser path
CMD ["/bin/bash", "-c", "source /usr/src/app/browser_path.sh && node index.js"]