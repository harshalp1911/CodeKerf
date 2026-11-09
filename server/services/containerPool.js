// Container Pool Service
// Keeps locked-down containers started ahead of time so a run doesn't wait for one.
// Each container runs exactly one program and is then deleted, so nothing a program
// leaves behind (background processes, files, changed tools) can reach the next run.

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const POOL_SIZE = 2;          // containers kept ready per language
const MAX_CONTAINERS = 4;     // ready + running per language, so a flood of runs can't start unlimited containers
const ACQUIRE_TIMEOUT_MS = 5000;
const RUN_TIMEOUT_MS = 15000; // compile + run; the program itself also gets `timeout 5s`
const MAX_OUTPUT = 64 * 1024;
const RETRY_DELAY_MS = 10000;
const LABEL = 'codekerf.runner';

const LANGUAGES = {
  cpp: {
    image: 'cpp-runner:latest',
    pids: 64,
    file: 'code.cpp',
    cmd: 'g++ code.cpp -o main && timeout 5s ./main < stdin.txt'
  },
  python: {
    image: 'python-runner:latest',
    pids: 64,
    file: 'code.py',
    cmd: 'timeout 5s python3 code.py < stdin.txt'
  },
  java: {
    image: 'java-runner:latest',
    pids: 128, // the JVM starts many threads, and each one counts as a process
    file: 'Main.java',
    cmd: 'javac Main.java && timeout 5s java Main < stdin.txt'
  }
};

// Runs a docker command directly, without a shell in between
const docker = (args) => new Promise((resolve, reject) => {
  const child = spawn('docker', args);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve(stdout.trim());
    else reject(new Error(stderr.trim() || `docker ${args[0]} exited with code ${code}`));
  });
});

class ContainerPool {
  constructor() {
    this.ready = {};    // started containers waiting for a run
    this.creating = {}; // containers being started
    this.inUse = {};    // containers running someone's code
    this.waiting = {};  // runs waiting for a container
    for (const lang of Object.keys(LANGUAGES)) {
      this.ready[lang] = [];
      this.creating[lang] = 0;
      this.inUse[lang] = 0;
      this.waiting[lang] = [];
    }
    this.closed = false;
  }

  async init() {
    console.log('🏊 Initializing container pool...');
    await this._removeLeftovers();
    for (const lang of Object.keys(LANGUAGES)) this._fill(lang);
  }

  // Containers from an earlier server run that stopped before deleting them
  async _removeLeftovers() {
    try {
      const ids = (await docker(['ps', '-aq', '--filter', `label=${LABEL}`])).split('\n').filter(Boolean);
      if (ids.length) await docker(['rm', '-f', ...ids]);
    } catch (err) {
      console.error('⚠️ Could not remove old runner containers:', err.message);
    }
  }

  // Start containers until POOL_SIZE are ready, without going over MAX_CONTAINERS
  _fill(lang) {
    const total = () => this.ready[lang].length + this.creating[lang] + this.inUse[lang];
    while (!this.closed
      && this.ready[lang].length + this.creating[lang] < POOL_SIZE
      && total() < MAX_CONTAINERS) {
      this.creating[lang]++;
      this._create(lang)
        .then((name) => {
          this.creating[lang]--;
          this._handOut(lang, name);
        })
        .catch((err) => {
          this.creating[lang]--;
          console.error(`⚠️ Failed to create ${lang} container:`, err.message);
          setTimeout(() => this._fill(lang), RETRY_DELAY_MS).unref();
        });
    }
  }

  async _create(lang) {
    const { image, pids } = LANGUAGES[lang];
    const name = `codekerf-${lang}-${crypto.randomBytes(4).toString('hex')}`;
    await docker([
      'run', '-d',
      '--name', name,
      '--label', LABEL,
      '--network', 'none',
      '--memory', '128m',
      '--cpus', '0.5',
      '--pids-limit', String(pids),     // stops fork bombs
      '--user', 'runner',               // never root, even if the image changes
      '--cap-drop', 'ALL',              // no special kernel permissions
      '--security-opt', 'no-new-privileges',
      '--ulimit', 'fsize=10485760',     // no single file over 10 MB
      '--ulimit', 'nofile=256:256',
      '--tmpfs', '/tmp:rw,size=16m',
      '-w', '/workspace',
      image, 'sleep', 'infinity'
    ]);
    return name;
  }

  // Give a new container to a waiting run, or keep it ready for the next one
  _handOut(lang, name) {
    if (this.closed) {
      docker(['rm', '-f', name]).catch(() => {});
      return;
    }
    const waiter = this.waiting[lang].shift();
    if (waiter) {
      this.inUse[lang]++;
      waiter(name);
    } else {
      this.ready[lang].push(name);
    }
    this._fill(lang);
  }

  // Resolves to a container, or to null if none frees up within ACQUIRE_TIMEOUT_MS
  _acquire(lang) {
    const name = this.ready[lang].shift();
    if (name) {
      this.inUse[lang]++;
      this._fill(lang);
      return Promise.resolve(name);
    }
    return new Promise((resolve) => {
      const waiter = (container) => {
        clearTimeout(timer);
        resolve(container);
      };
      const timer = setTimeout(() => {
        this.waiting[lang] = this.waiting[lang].filter((w) => w !== waiter);
        resolve(null);
      }, ACQUIRE_TIMEOUT_MS);
      this.waiting[lang].push(waiter);
    });
  }

  // Deleting the container is the cleanup: it ends every process the program started
  async _destroy(lang, name) {
    try {
      await docker(['rm', '-f', name]);
    } catch (err) {
      // A run stopped for time or output is already being removed by _exec
      if (!/already in progress|No such container/.test(err.message)) {
        console.error(`⚠️ Failed to remove container ${name}:`, err.message);
      }
    }
    this.inUse[lang]--;
    this._fill(lang);
  }

  // Runs code in a fresh container. Resolves to null when every container stays busy.
  async run(lang, code, stdin) {
    const config = LANGUAGES[lang];
    const name = await this._acquire(lang);
    if (!name) return null;

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-run-')).catch(() => null);
    try {
      if (!dir) throw new Error('Could not create a temporary folder');
      await fs.writeFile(path.join(dir, config.file), code);
      await fs.writeFile(path.join(dir, 'stdin.txt'), stdin);
      await docker(['cp', path.join(dir, config.file), `${name}:/workspace/${config.file}`]);
      await docker(['cp', path.join(dir, 'stdin.txt'), `${name}:/workspace/stdin.txt`]);
      return await this._exec(name, config.cmd);
    } finally {
      if (dir) fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      this._destroy(lang, name);
    }
  }

  // Runs the command, stopping it at RUN_TIMEOUT_MS or MAX_OUTPUT by deleting the container
  _exec(name, cmd) {
    return new Promise((resolve) => {
      const child = spawn('docker', ['exec', name, 'bash', '-c', cmd]);
      const output = { stdout: '', stderr: '' };
      let stoppedFor = null;

      const stop = (reason) => {
        if (stoppedFor) return;
        stoppedFor = reason;
        docker(['rm', '-f', name]).catch(() => {});
      };

      const collect = (stream) => (data) => {
        if (stoppedFor) return; // after a stop, docker's own error messages would end up here
        output[stream] += data;
        if (output.stdout.length + output.stderr.length > MAX_OUTPUT) stop('output');
      };
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', collect('stdout'));
      child.stderr.on('data', collect('stderr'));

      const timer = setTimeout(() => stop('time'), RUN_TIMEOUT_MS);

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ stdout: '', stderr: `Could not run the code: ${err.message}` });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        let stdout = output.stdout.slice(0, MAX_OUTPUT);
        let stderr = output.stderr.slice(0, MAX_OUTPUT - stdout.length);
        const notes = [];
        if (stoppedFor === 'output') notes.push(`[Output truncated: the limit is ${MAX_OUTPUT / 1024} KB]`);
        else if (stoppedFor === 'time') notes.push(`[Stopped: compiling and running took over ${RUN_TIMEOUT_MS / 1000} seconds]`);
        else if (code === 124) notes.push('[Stopped: the program ran for over 5 seconds]');
        else if (code === 137) notes.push('[Stopped: the program used too much memory]');
        if (notes.length) stderr += (stderr && !stderr.endsWith('\n') ? '\n' : '') + notes.join('\n');
        resolve({ stdout, stderr });
      });
    });
  }

  async shutdown() {
    console.log('🏊 Shutting down container pool...');
    this.closed = true;
    for (const lang of Object.keys(LANGUAGES)) {
      this.waiting[lang].forEach((waiter) => waiter(null));
      this.waiting[lang] = [];
      this.ready[lang] = [];
    }
    await this._removeLeftovers();
    console.log('🏊 Container pool shut down.');
  }
}

// Singleton instance
const pool = new ContainerPool();

module.exports = pool;
module.exports.LANGUAGES = LANGUAGES;
