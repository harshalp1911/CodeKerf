# 🚀 CodeKerf - Real-Time Collaborative Code Editor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://www.docker.com/) [![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

**CodeKerf** is a modern, real-time collaborative coding platform that enables multiple developers to code together seamlessly. Built with cutting-edge web technologies, it provides a VS Code-like experience in the browser with advanced collaboration features.

## ✨ Key Features

### 🤝 **Real-Time Collaboration**
- **Multi-cursor tracking** - See where other users are typing with colored cursors and name labels
- **Live code synchronization** - Code changes appear instantly across all connected users
- **Typing indicators** - Know when someone is typing in chat with animated dots
- **Whiteboard pointer tracking** - See mouse movements on the shared whiteboard
- **Role-based permissions** - Owner, Editor, and Viewer roles with appropriate access levels

### 💻 **Advanced Code Editor**
- **Multi-language support** - C++, Python, and Java with syntax highlighting
- **Resizable panels** - Drag to adjust editor/output split
- **Dark theme UI** - Modern, eye-friendly interface
- **Code execution** - Run code in isolated Docker containers
- **Real-time output** - See execution results instantly

### 🎨 **Interactive Whiteboard**
- **Drawing tools** - Pencil, eraser, shapes (rectangle, circle, triangle, line)
- **Text annotations** - Add and edit text directly on the whiteboard
- **Color palette** - Multiple colors for drawing and text
- **Real-time sync** - All drawing actions sync across users
- **Collaborative editing** - Multiple users can draw simultaneously

### 💬 **Integrated Chat**
- **Real-time messaging** - Instant chat with all room members
- **Typing indicators** - See when others are composing messages
- **Message persistence** - Chat history maintained during session
- **Floating UI** - Non-intrusive chat panel that doesn't block code

### 🔐 **Authentication & Security**
- **Google OAuth integration** - Sign in with Google account
- **JWT-based authentication** - Secure token-based auth system
- **Room-based access control** - Private rooms with invitation system
- **Auto-room deletion** - Rooms automatically deleted when owner leaves

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/harshalp1911/CodeKerf.git
   cd CodeKerf
   ```

2. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your Google OAuth credentials
   ```

3. **Build and start services**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application**
   - Open your browser at `http://localhost:3000`
   - Sign in with Google or create an account
   - Create a room and start collaborating!

## 🏗️ Architecture

**CodeKerf** uses a **monolithic architecture** with containerized services:

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeKerf Platform                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)                                           │
│  ├── Real-time Editor (CodeMirror)                         │
│  ├── Collaborative Whiteboard (Fabric.js)                  │
│  ├── Chat System                                           │
│  └── Authentication UI                                      │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + Express)                               │
│  ├── Socket.IO Server (Real-time events)                   │
│  ├── REST API (Room management, Auth)                      │
│  ├── JWT Authentication                                     │
│  └── Google OAuth Integration                              │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                             │
│  ├── MongoDB (Users, Rooms, Chat, Whiteboard)             │
│  └── Redis (Session Management)                            │
├─────────────────────────────────────────────────────────────┤
│  Code Execution Layer                                       │
│  ├── Python Runner (Docker Container)                      │
│  ├── C++ Runner (Docker Container)                         │
│  └── Java Runner (Docker Container)                        │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **CodeMirror 6** - Advanced code editor with syntax highlighting
- **Fabric.js** - Interactive whiteboard canvas
- **Socket.IO Client** - Real-time communication
- **CSS Variables** - Dynamic theming system

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - JSON Web Token authentication
- **Google OAuth 2.0** - Social authentication

### Database
- **MongoDB** - Document database for application data
- **Redis** - In-memory store for session management
- **Mongoose** - MongoDB object modeling

### Infrastructure
- **Docker** - Containerization for code execution
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy and static file serving

## 📈 Performance Optimizations

- ✅ Alpine Docker images (70-80% smaller)
- ✅ Redis for Socket.io scaling
- ✅ Room-based socket isolation
- ✅ TTL indexes for auto-cleanup
- 🚧 Container pooling
- 🚧 Cursor throttling
- 🚧 Whiteboard action batching 

## 📁 Project Structure

```
CodeKerf/
├── client/                     # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Room/          # Room-related components
│   │   │   ├── Chat/          # Chat system
│   │   │   └── Whiteboard/    # Whiteboard components
│   │   ├── pages/             # Main pages
│   │   ├── context/           # React context providers
│   │   └── utils/             # Utility functions
│   └── package.json
├── server/                     # Node.js backend
│   ├── models/                # Database models
│   ├── routes/                # Express routes
│   ├── middleware/            # Custom middleware
│   ├── index.js               # Main server file
│   └── package.json
├── docker/                     # Docker configurations
│   ├── cpp-runner/            # C++ execution environment
│   ├── python-runner/         # Python execution environment
│   └── java-runner/           # Java execution environment
├── nginx/                      # Nginx configuration
├── docker-compose.yml          # Service orchestration
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create `server/.env` with the following variables:

```env
# Database
MONGO_URI=mongodb://mongo:27017/codekerf
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Server
PORT=5001
NODE_ENV=development
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000` to authorized origins
6. Add the credentials to your `.env` file

## 🚀 Deployment

### Production Deployment

1. **Update environment variables** for production
2. **Build and deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```
3. **Configure domain and SSL** (recommended)

### Docker Services

- **client**: React frontend served by Nginx
- **server**: Node.js backend with Socket.IO
- **mongo**: MongoDB database
- **redis**: Redis for session management
- **python-runner**: Isolated Python execution
- **cpp-runner**: Isolated C++ execution
- **java-runner**: Isolated Java execution

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## �‍💻 Author

**Harshal Patil**
- Email: [harshalp0602@gmail.com](mailto:harshalp0602@gmail.com)
- GitHub: [@harshalp1911](https://github.com/harshalp1911)
---

⭐ **Star this repository if you found it helpful!**
