# Use Node.js as base image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire project
COPY . .

# Expose the port Playwright will use
EXPOSE 8080

# Start the API
CMD ["node", "index.js"]