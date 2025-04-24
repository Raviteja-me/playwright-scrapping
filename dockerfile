# Use the base image without platform specification
FROM mcr.microsoft.com/playwright:v1.51.0-jammy

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Create directory for cookies
RUN mkdir -p /tmp/cookies
ENV COOKIES_PATH=/tmp/cookies/linkedin_cookies.json

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Make sure we have the LinkedIn credentials
ARG LINKEDIN_USERNAME
ARG LINKEDIN_PASSWORD
ENV LINKEDIN_USERNAME=${LINKEDIN_USERNAME}
ENV LINKEDIN_PASSWORD=${LINKEDIN_PASSWORD}

# Expose the port
EXPOSE 8080

# Start the app directly with node
CMD ["node", "index.js"]