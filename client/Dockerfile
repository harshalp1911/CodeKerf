# 1. Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Serve stage
FROM nginx:alpine
# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d
# Copy build output
COPY --from=builder /app/build /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80
