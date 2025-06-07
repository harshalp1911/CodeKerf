# server/Dockerfile

# 1. Use a minimal Node.js base
FROM node:18-alpine

# 2. Create app directory
WORKDIR /usr/src/app

# 3. Copy package manifests and install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# 4. Copy the rest of the server code
COPY . .

# 5. Expose the port the app runs on
EXPOSE 5001

# 6. Start the server
CMD ["node", "index.js"]
