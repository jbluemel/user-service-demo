# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Change ownership of the app directory to the nodejs user
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose the port the app runs on
EXPOSE 3000

# Add build-time arguments that can be passed during image build
ARG APP_VERSION=1.0.0
ARG BUILD_TIME
ARG GIT_COMMIT

# Set environment variables from build args
ENV APP_VERSION=$APP_VERSION
ENV BUILD_TIME=$BUILD_TIME
ENV GIT_COMMIT=$GIT_COMMIT

# Health check to ensure the container is working
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1


# Start the application
CMD ["npm", "start"]
