# syntax=docker/dockerfile:1

ARG NODE_VERSION=16

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV production

WORKDIR /usr/src/app

# Download dependencies as a separate step to take advantage of Docker's caching.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy the rest of the source files into the image.
COPY . .

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 8080

# Use node directly to run the application
CMD ["node", "index.js"]
