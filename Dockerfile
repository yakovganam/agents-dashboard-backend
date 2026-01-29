# Dockerfile for Agents Dashboard Backend
FROM node:20-slim

# Install sqlite3 dependencies
RUN apt-get update && apt-get install -y python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Ensure db directory exists for volume mount
RUN mkdir -p /app/db

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server.js"]
