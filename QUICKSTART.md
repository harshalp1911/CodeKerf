# CodeKerf Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Build Docker Runner Images

**Start Docker Desktop first**, then run:

```bash
./build-runners.sh
```

Or manually:
```bash
cd docker/cpp-runner && docker build -t cpp-runner:latest . && cd ../..
cd docker/python-runner && docker build -t python-runner:latest . && cd ../..
cd docker/java-runner && docker build -t java-runner:latest . && cd ../..
```

### Step 2: Configure Environment

```bash
# Server environment
cp server/.env.example server/.env

# Client environment  
cp client/.env.example client/.env
```

**Edit `server/.env`** and set:
- `JWT_SECRET` - Change to a random string
- `GOOGLE_CLIENT_ID` - (Optional, for Google OAuth)
- `GOOGLE_CLIENT_SECRET` - (Optional, for Google OAuth)

### Step 3: Start with Docker Compose

```bash
docker-compose up -d --build
```

This starts:
- ✅ React frontend (port 3000)
- ✅ Express backend (port 5001)
- ✅ MongoDB (port 27017)
- ✅ Redis (port 6379)

### Step 4: Access the Application

Open your browser: **http://localhost:3000**

## 🧪 Testing the Application

### Test Anonymous User (No Login Required)
1. Go to http://localhost:3000
2. You should see the code editor
3. Write some code and click **RUN**
4. Output appears on the right

### Test Authentication
1. Click **Login** button
2. Register with email/password
3. After login, you can now:
   - Create rooms
   - Join rooms
   - Share code

### Test Room Collaboration
1. Login as User A
2. Create a room
3. Invite User B (by email)
4. Both users can code together in real-time

## 🛠️ Local Development (Without Docker)

### Terminal 1: Start MongoDB & Redis
```bash
docker run -d -p 27017:27017 --name mongo mongo:6.0
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Terminal 2: Start Server
```bash
cd server
npm install
npm run dev
```

### Terminal 3: Start Client
```bash
cd client
npm install
npm start
```

### Terminal 4: Build Runner Images
```bash
./build-runners.sh
```

## 📋 Verification Checklist

- [ ] Docker daemon is running
- [ ] Runner images built (cpp, python, java)
- [ ] MongoDB is running (port 27017)
- [ ] Redis is running (port 6379)
- [ ] Server is running (port 5001)
- [ ] Client is running (port 3000)
- [ ] Can execute code as anonymous user
- [ ] Can register/login
- [ ] Can create rooms (after login)

## 🐛 Common Issues

### "Cannot connect to Docker daemon"
```bash
# Start Docker Desktop
```

### "Port 3000 already in use"
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

### "MongoDB connection failed"
```bash
# Check if MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker restart mongo
```

### "Redis connection failed"
```bash
# Check if Redis is running
docker ps | grep redis

# Restart Redis
docker restart redis
```

## 🎯 What's Working Now

✅ **Backend Complete:**
- Authentication (Google OAuth + Email/Password)
- Room management (Create, Join, Delete)
- Member management (Invite, Role assignment)
- Real-time code sync via Socket.io
- Whiteboard sync (action-based)
- Chat messaging
- Code execution (C++, Python, Java)

✅ **Frontend Structure:**
- Authentication context
- Protected routes
- Dashboard, Login, Room pages
- Component structure ready

🚧 **Needs UI Implementation:**
- Multi-cursor display
- Whiteboard drawing tools
- Join approval popup
- Disabled button states for anonymous users

## 📚 Next Steps

1. **Test the current setup** - Make sure everything runs
2. **Configure Google OAuth** (optional) - For social login
3. **Implement remaining UI** - Multi-cursor, whiteboard, etc.
4. **Deploy to production** - When ready

## 💡 Tips

- Use **email/password auth** for quick testing (no Google OAuth setup needed)
- Check `IMPLEMENTATION_STATUS.md` for detailed progress
- See `SETUP.md` for comprehensive setup guide
- All backend APIs are ready and documented in route files

---

**Need help?** Check the logs:
```bash
# Docker logs
docker-compose logs -f server
docker-compose logs -f client

# Local development
# Server logs appear in Terminal 2
# Client logs appear in Terminal 3
```
