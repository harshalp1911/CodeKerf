# server/Dockerfile

FROM node:18-alpine

# 1. Install Docker CLI so "docker" is available
RUN apk add --no-cache docker-cli

# 2. App directory
WORKDIR /usr/src/app

# 3. Install production deps
COPY package*.json ./
RUN npm ci --omit=dev

# 4. Copy server code
COPY . .

# 5. Expose server port
EXPOSE 5001

# 6. Start the server
CMD ["node", "index.js"]
