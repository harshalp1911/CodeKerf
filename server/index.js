// server/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const app = express();

// MongoDB setup
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/online-code-editor';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Session model with TTL index on updatedAt (30 days)
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  language: String,
  code: String,
  updatedAt: Date
});
sessionSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);
const Session = mongoose.model('Session', sessionSchema);

// Middleware
app.use(cors());
app.use(express.json());

// REST endpoints
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

app.post('/api/run', async (req, res) => {
  const { language, code, stdin } = req.body;
  let fileName, runCmd, imageName;

  if (language === 'cpp') {
    fileName = 'code.cpp';
    imageName = 'cpp-runner:latest';
    runCmd = `g++ ${fileName} -o main && timeout 5s ./main < stdin.txt`;
  } else if (language === 'python') {
    fileName = 'code.py';
    imageName = 'python-runner:latest';
    runCmd = `timeout 5s python3 ${fileName} < stdin.txt`;
  } else if (language === 'java') {
    fileName = 'Main.java';
    imageName = 'java-runner:latest';
    runCmd = `javac ${fileName} && timeout 5s java Main < stdin.txt`;
  } else {
    return res.status(400).json({ stdout: '', stderr: 'Unsupported language' });
  }

  const tmpDir = path.join(os.tmpdir(), `code-run-${uuidv4()}`);
  try {
    await fs.mkdir(tmpDir);
    await fs.writeFile(path.join(tmpDir, fileName), code);
    await fs.writeFile(path.join(tmpDir, 'stdin.txt'), stdin || '');

    const dockerCmd = [
      'docker run --rm',
      '--network none',
      '--memory 128m',
      '--cpus 0.5',
      `-v ${tmpDir}:/workspace`,
      imageName,
      `bash -c "${runCmd}"`
    ].join(' ');

    console.log('Executing:', dockerCmd);
    const { stdout, stderr } = await exec(dockerCmd, { timeout: 10000 });
    res.json({ stdout, stderr });
  } catch (err) {
    console.error(err);
    res.json({
      stdout: err.stdout || '',
      stderr: err.stderr || err.message
    });
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
  }
});

// HTTP + Socket.io setup
const PORT = process.env.PORT || 5001;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:3000', methods: ['GET','POST'] }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinSession', async (sessionId) => {
    socket.join(sessionId);
    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({
        sessionId,
        language: 'cpp',
        code: '',
        updatedAt: new Date()
      });
      await session.save();
    }
    socket.emit('initSession', {
      code: session.code,
      language: session.language
    });
  });

  socket.on('codeChange', async ({ sessionId, code }) => {
    await Session.updateOne(
      { sessionId },
      { code, updatedAt: new Date() }
    );
    socket.to(sessionId).emit('codeUpdate', code);
  });

  socket.on('languageChange', async ({ sessionId, language }) => {
    await Session.updateOne(
      { sessionId },
      { language, updatedAt: new Date() }
    );
    socket.to(sessionId).emit('languageUpdate', language);
  });

  // ← NEW: rebroadcast run results to others
  socket.on('runResult', ({ sessionId, stdout, stderr }) => {
    socket.to(sessionId).emit('runResult', { stdout, stderr });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
