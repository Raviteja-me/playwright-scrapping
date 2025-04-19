# Use Playwright's official image with browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.51.0

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

# Expose port for Cloud Run
EXPOSE 8080

# Start the API
CMD ["node", "index.js"]