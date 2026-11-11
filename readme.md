# CodeKerf: Real-Time Collaborative Code Editor

[![CI](https://github.com/harshalp1911/CodeKerf/actions/workflows/ci.yml/badge.svg)](https://github.com/harshalp1911/CodeKerf/actions/workflows/ci.yml)

CodeKerf is a browser-based code editor where you can write and run C++, Python and Java, share your code through a one-time link, and work together in private rooms with live editing, chat and a shared whiteboard.

## Features

**Without an account**
- Write, run and download C++, Python and Java code, with input (stdin) support
- Share your code through one **viewer link**: whoever opens it first watches your code and its output live, read-only

**With an account** (email and password, or Google)
- Share **editor links**: the other person (also logged in) can edit and run the code with you
- Stop sharing and create a new link at any time
- Create **rooms** and invite people by email as editors or viewers
- In a room: live code editing with everyone's cursors, chat with history, and a shared whiteboard (pen, shapes, text, eraser)
- Change someone's role or remove them, and it applies to their open tab immediately

## How it works

### Running untrusted code safely
Every run happens in a Docker container that is used once and then deleted.

- **Fresh container per run.** The server keeps a few containers started ahead of time so runs are fast. Each runs exactly one program and is then deleted, so nothing a program leaves behind (background processes, files, changed tools) can reach the next person's code.
- **Locked down.** Code runs as a normal user (not root), with no network, no extra kernel permissions, 128 MB of memory, half a CPU, at most 64 processes (fork bombs stop there), and no file over 10 MB.
- **Hard limits.** A program is stopped after 5 seconds of running (15 seconds including compiling) or 64 KB of output. Stopping means deleting the container, so every process it started ends too.
- **Rate limited.** Guests get 10 runs a minute (counted by IP address), logged-in users 30 (counted by account). The counters live in Redis, so the limit holds across several servers.
- **Bounded load.** At most 4 containers per language exist at once. When all are busy, a run waits up to 5 seconds, then gets a "server busy" answer instead of starting more containers.

### One-time share links
- Links use a random 128-bit token, never a database ID, so they can't be guessed.
- **Exactly one person can claim a link.** The claim is a single atomic database update that only succeeds while the link is unclaimed, so when several people open it at the same moment, one gets in. (A test opens one link from 8 sockets at once.)
- Each person has at most one active link, enforced by unique database indexes, so a double click can't create two.
- Viewer links are tied to the claimant's browser; editor links to their account. Links expire after 24 hours.

### Permissions
- Every socket event checks the sender's room role, read from the database when they join. Nothing the client sends about its own role or identity is trusted.
- When an owner changes a role or removes someone, the server removes their open connections from the room straight away, so they can't keep editing until they refresh.
- Each connection's events are processed in the order they arrived, so quick edits are saved in order and the latest code is what's kept.

## Architecture

```
Browser (React, CodeMirror, Fabric.js, Socket.IO client)
   │  HTTP + WebSocket
   ▼
nginx ── serves the React build, proxies /api and /socket.io
   │
   ▼
Node.js server
   ├─ app.js       Express: auth, rooms, members, share links, /api/run
   ├─ sockets.js   Socket.IO: live code, chat, whiteboard, cursors, share links
   └─ services/containerPool.js ── Docker ──► single-use runner containers
   │                                          (cpp-runner, python-runner, java-runner)
   ├─ MongoDB   users, rooms, members, chat, whiteboards, share links
   └─ Redis     Socket.IO adapter (events across server instances), run rate limit
```

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, CodeMirror 6, Fabric.js 5, Socket.IO client |
| Backend | Node.js, Express 5, Socket.IO 4, JWT, Passport (Google OAuth) |
| Data | MongoDB with Mongoose 8, Redis 7 |
| Code execution | Docker, Alpine-based runner images |
| Testing and CI | Jest, real MongoDB and Redis, GitHub Actions |

## Getting started

You need Docker with Docker Compose.

1. **Clone the repository**
   ```bash
   git clone https://github.com/harshalp1911/CodeKerf.git
   cd CodeKerf
   ```

2. **Build the runner images** that user code runs in
   ```bash
   ./build-runners.sh
   ```

3. **Create `server/.env`** and set at least `JWT_SECRET` to a long random string (see [Configuration](#configuration))
   ```bash
   cp server/.env.example server/.env
   ```

4. **Start everything**
   ```bash
   docker-compose up -d --build
   ```

5. Open **http://localhost:3000**

## Running the tests

The tests start the real app and talk to it over HTTP and WebSockets, using a real MongoDB and Redis. Docker is replaced by a fake runner, except in the sandbox tests.

```bash
docker run -d --name codekerf-test-mongo -p 27017:27017 mongo:6.0
docker run -d --name codekerf-test-redis -p 6379:6379 redis:7-alpine
cd server
npm install
npm test               # permissions, rooms, share links, run limits
npm run test:sandbox   # the real Docker sandbox (needs python-runner:latest)
```

The tests use the `codekerf-test` database and Redis database 15. To point them elsewhere, set `TEST_MONGO_URI` and `TEST_REDIS_URL`.

GitHub Actions runs the server tests, the sandbox tests and a client build on every push and pull request.

## Local development without Docker Compose

```bash
docker run -d -p 27017:27017 mongo:6.0
docker run -d -p 6379:6379 redis:7-alpine
./build-runners.sh

cd server && npm install && npm run dev     # API on :5002
cd client && npm install && npm start       # app on :3000, proxies /api and /socket.io to :5002
```

## Configuration

`server/.env`:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs login tokens. **Required in production**: the server refuses to start without it. |
| `MONGO_URI` | MongoDB connection (set by docker-compose) |
| `REDIS_URL` | Redis connection (set by docker-compose) |
| `CLIENT_URL` | Where the app is served, for CORS and the Google callback (default `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, for Google login |
| `PORT` | API port (default 5002) |
| `TRUST_PROXY` | Set to `1` behind nginx so the rate limit sees visitors' real IPs (set by docker-compose) |

For Google login, create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/) with the redirect URI `http://localhost:3000/api/auth/google/callback`.

## Project structure

```
├── client/                  React app
│   ├── nginx.conf           Serves the build and proxies the API in Docker
│   └── src/
│       ├── pages/           Landing page, dashboard, room, share link page
│       ├── components/      Editor, chat, whiteboard, members, login, share dialog
│       ├── hooks/           useCodeShare: live sharing from the landing page
│       └── utils/
├── server/
│   ├── index.js             Connects to MongoDB and Redis and starts the server
│   ├── app.js               Express app and HTTP routes
│   ├── sockets.js           Socket.IO events
│   ├── routes/              auth, rooms, members, shares
│   ├── models/              Mongoose models
│   ├── middleware/          auth, run rate limit
│   ├── services/            containerPool (code sandbox), Google login
│   └── tests/               Jest tests
├── docker/                  Runner images: cpp-runner, python-runner, java-runner
├── .github/workflows/       CI
└── docker-compose.yml
```

## Known limitations

- Two people typing in the same place at the same moment can overwrite each other's change; the last edit wins. Merging simultaneous edits would need a CRDT such as Yjs.
- The server starts runner containers through the host's Docker socket, so a flaw in the server itself would give access to Docker. The runners themselves are locked down as described above.
- Guests behind one shared IP address (a college or office network) share the guest run limit.
- Rooms, chat and whiteboards are deleted after 2 days.

## Author

**Harshal Patil**
- Email: [harshalp0602@gmail.com](mailto:harshalp0602@gmail.com)
- GitHub: [@harshalp1911](https://github.com/harshalp1911)
