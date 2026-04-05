# CodeKerf Setup Guide

## Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ installed (for local development)
- MongoDB running (or use Docker Compose)
- Redis running (or use Docker Compose)

## Quick Start with Docker Compose

1. **Build Docker runner images first:**
```bash
cd docker/cpp-runner && docker build -t cpp-runner:latest .
cd ../python-runner && docker build -t python-runner:latest .
cd ../java-runner && docker build -t java-runner:latest .
cd ../..
```

2. **Set up environment variables:**
```bash
# Server
cp server/.env.example server/.env
# Edit server/.env and add your Google OAuth credentials

# Client
cp client/.env.example client/.env
```

3. **Start all services:**
```bash
docker-compose up -d --build
```

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## Local Development Setup

### Server Setup

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start MongoDB and Redis:**
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongo mongo:6.0
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

4. **Build Docker runner images** (see Quick Start step 1)

5. **Start the server:**
```bash
npm run dev
```

### Client Setup

1. **Install dependencies:**
```bash
cd client
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
```

3. **Start the client:**
```bash
npm start
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5001/api/auth/google/callback`
6. Copy Client ID and Client Secret to your `.env` files

## Environment Variables

### Server (.env)
- `PORT` - Server port (default: 5002)
- `MONGO_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT tokens (change in production!)
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `CLIENT_URL` - Frontend URL (default: http://localhost:3000)

### Client (.env)
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_GOOGLE_CLIENT_ID` - Google OAuth Client ID

## Docker Image Optimization

The project uses Alpine-based Docker images for better performance:
- `gcc:13-alpine` (~100MB vs 1GB+)
- `python:3.11-alpine` (~50MB vs 900MB+)
- `openjdk:17-alpine` (~150MB vs 600MB+)

This provides:
- 70-80% size reduction
- Faster startup times
- Lower memory footprint

## Troubleshooting

### Docker daemon not running
```bash
# Start Docker Desktop or Docker daemon
```

### Port already in use
```bash
# Change ports in docker-compose.yml or .env files
```

### MongoDB connection failed
```bash
# Ensure MongoDB is running
docker ps | grep mongo
```

### Redis connection failed
```bash
# Ensure Redis is running
docker ps | grep redis
```

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│    Server    │────▶│   MongoDB   │
│  (React)    │     │  (Express)   │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     
                           ▼                     
                    ┌──────────────┐            
                    │    Redis     │            
                    │ (Socket.io)  │            
                    └──────────────┘            
                           │                     
                           ▼                     
                    ┌──────────────┐            
                    │Docker Runners│            
                    │ C++/Py/Java  │            
                    └──────────────┘            
```

## Features

- ✅ Google OAuth + Email/Password authentication
- ✅ Real-time collaborative coding
- ✅ Room-based access control (owner/editor/viewer)
- ✅ Secure Docker-based code execution
- ✅ Multi-cursor tracking
- ✅ Whiteboard integration
- ✅ Chat functionality
- ✅ Session persistence with MongoDB
- ✅ Scalable with Redis adapter

## Next Steps

1. Configure Google OAuth credentials
2. Start the application
3. Create an account or login
4. Create a room and invite collaborators
5. Start coding together!
