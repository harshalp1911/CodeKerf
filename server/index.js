// server/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs').promises;
const os   = require('os');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const app = express();
const PORT = process.env.PORT || 5001;

// ── 1) MONGO ─────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/online-code-editor';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Mongo connected'))
  .catch(e => console.error('❌ Mongo error', e));

// TTL session schema
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true },
  language:  String,
  code:      String,
  updatedAt: Date
});
sessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const Session = mongoose.model('Session', sessionSchema);

// ── 2) MIDDLEWARE ─────────────────────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:3000',  // <-- only your CRA origin
  methods: ['GET','POST'],
  credentials: true
}));
app.use(express.json());

// ── 3) REST ───────────────────────────────────────────────────────────────
app.get('/api/ping', (_req, res) => res.json({ message: 'pong' }));

app.post('/api/run', async (req, res) => {
  const { language, code, stdin } = req.body;
  let fileName, imageName, runCmd;

  if (language === 'cpp') {
    fileName  = 'code.cpp';
    imageName = 'cpp-runner:latest';
    runCmd    = `g++ ${fileName} -o main && timeout 5s ./main < stdin.txt`;
  } else if (language === 'python') {
    fileName  = 'code.py';
    imageName = 'python-runner:latest';
    runCmd    = `timeout 5s python3 ${fileName} < stdin.txt`;
  } else if (language === 'java') {
    fileName  = 'Main.java';
    imageName = 'java-runner:latest';
    runCmd    = `javac ${fileName} && timeout 5s java Main < stdin.txt`;
  } else {
    return res.status(400).json({ stdout:'', stderr:'Unsupported language' });
  }

  const tmp = path.join(os.tmpdir(), `code-run-${uuidv4()}`);
  try {
    await fs.mkdir(tmp);
    await fs.writeFile(path.join(tmp, fileName), code);
    await fs.writeFile(path.join(tmp, 'stdin.txt'), stdin||'');

    const cmd = [
      'docker run --rm --network none --memory 128m --cpus 0.5',
      `-v ${tmp}:/workspace`, imageName,
      `bash -c "${runCmd}"`
    ].join(' ');

    console.log('▶️', cmd);
    const { stdout, stderr } = await exec(cmd, { timeout: 10000 });
    res.json({ stdout, stderr });
  } catch (err) {
    console.error(err);
    res.json({
      stdout: err.stdout  || '',
      stderr: err.stderr  || err.message
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(()=>{/*ignore*/});
  }
});

// ── 4) SOCKET.IO ───────────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET','POST'],
    credentials: true
  }
});

io.on('connection', socket => {
  console.log('🔌', socket.id);

  socket.on('joinSession', async sessionId => {
    socket.join(sessionId);
    let s = await Session.findOne({ sessionId });
    if (!s) {
      s = await Session.create({
        sessionId,
        language: 'cpp',
        code:     '',
        updatedAt: new Date()
      });
    }
    socket.emit('initSession', { code: s.code, language: s.language });
  });

  socket.on('codeChange', async ({ sessionId, code }) => {
    await Session.updateOne({ sessionId }, { code, updatedAt: new Date() });
    socket.to(sessionId).emit('codeUpdate', code);
  });

  socket.on('languageChange', async ({ sessionId, language }) => {
    await Session.updateOne({ sessionId }, { language, updatedAt: new Date() });
    socket.to(sessionId).emit('languageUpdate', language);
  });

  socket.on('runResult', ({ sessionId, stdout, stderr }) => {
    socket.to(sessionId).emit('runResult', { stdout, stderr });
  });

  socket.on('disconnect', () => console.log('❌', socket.id));
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Listening on port ${PORT}`);
});
