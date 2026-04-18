// Container Pool Service
// Pre-warms and reuses Docker containers for faster code execution

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const POOL_SIZE = 2; // containers per language

const LANGUAGES = {
  cpp:    { image: 'cpp-runner:latest',    name: 'pool-cpp' },
  python: { image: 'python-runner:latest', name: 'pool-python' },
  java:   { image: 'java-runner:latest',   name: 'pool-java' }
};

class ContainerPool {
  constructor() {
    this.pools = { cpp: [], python: [], java: [] };
    this.busy = new Set(); // container IDs currently in use
    this.initialized = false;
  }

  async init() {
    console.log('🏊 Initializing container pool...');

    for (const [lang, config] of Object.entries(LANGUAGES)) {
      for (let i = 0; i < POOL_SIZE; i++) {
        try {
          const containerId = await this._createContainer(lang, config, i);
          if (containerId) {
            this.pools[lang].push(containerId);
          }
        } catch (err) {
          console.error(`⚠️ Failed to create ${lang} container ${i}:`, err.message);
        }
      }
      console.log(`  ✅ ${lang}: ${this.pools[lang].length}/${POOL_SIZE} containers ready`);
    }

    this.initialized = true;
    console.log('🏊 Container pool ready!');
  }

  async _createContainer(lang, config, index) {
    const name = `${config.name}-${index}`;

    // Remove existing container with same name (if any)
    try {
      await exec(`docker rm -f ${name} 2>/dev/null`);
    } catch (_) { /* ignore */ }

    // Create a new long-running container with workspace volume
    const cmd = [
      'docker create',
      `--name ${name}`,
      '--network none',
      '--memory 128m',
      '--cpus 0.5',
      '-w /workspace',
      config.image,
      'sleep infinity'
    ].join(' ');

    const { stdout } = await exec(cmd);
    const containerId = stdout.trim();

    // Start the container
    await exec(`docker start ${name}`);

    return name;
  }

  async acquire(lang) {
    if (!this.pools[lang] || this.pools[lang].length === 0) {
      return null; // No pool for this language, fallback to old method
    }

    // Find an available container
    const available = this.pools[lang].find(c => !this.busy.has(c));

    if (available) {
      this.busy.add(available);
      return available;
    }

    // All containers busy, return null to fallback
    return null;
  }

  release(containerName) {
    this.busy.delete(containerName);
  }

  async execute(containerName, filePath, fileName, stdinPath, runCmd) {
    try {
      // Copy files into the container
      await exec(`docker cp ${filePath} ${containerName}:/workspace/${fileName}`);
      await exec(`docker cp ${stdinPath} ${containerName}:/workspace/stdin.txt`);

      // Execute the code inside the existing container
      const { stdout, stderr } = await exec(
        `docker exec ${containerName} bash -c "${runCmd}"`,
        { timeout: 10000 }
      );

      return { stdout, stderr };
    } catch (err) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message
      };
    } finally {
      // Clean workspace for next run
      try {
        await exec(`docker exec ${containerName} bash -c "rm -f /workspace/* 2>/dev/null"`);
      } catch (_) { /* ignore */ }
    }
  }

  async shutdown() {
    console.log('🏊 Shutting down container pool...');
    for (const [lang, containers] of Object.entries(this.pools)) {
      for (const name of containers) {
        try {
          await exec(`docker rm -f ${name}`);
        } catch (_) { /* ignore */ }
      }
    }
    console.log('🏊 Container pool shut down.');
  }
}

// Singleton instance
const pool = new ContainerPool();

module.exports = pool;
