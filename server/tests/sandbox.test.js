// The real code sandbox, using Docker and the python-runner image. Slower than the other tests,
// so it only runs when asked: `npm run test:sandbox` (CI builds the image and runs it too).
process.env.RUNNER_POOL_ID = 'test'; // never touch the containers of a server running on this machine

const { execSync } = require('child_process');
const pool = require('../services/containerPool');
const { waitFor } = require('./helpers');

const describeSandbox = process.env.SANDBOX_TESTS ? describe : describe.skip;
const runningContainers = () => execSync('docker ps -q --filter label=codekerf.runner=test --filter name=codekerf-python-')
  .toString().split('\n').filter(Boolean).length;
const python = (code, stdin = '') => pool.run('python', code, stdin);

describeSandbox('code sandbox', () => {
  beforeAll(async () => {
    await pool.init();
    await waitFor(() => pool.ready.python.length === 2, 60000);
  }, 90000);

  afterAll(() => pool.shutdown());

  test('runs code and reads input', async () => {
    expect((await python('print(input()[::-1])', 'olleh')).stdout).toBe('hello\n');
  });

  test('runs as a normal user that cannot change the system', async () => {
    const { stdout } = await python(`
import os
print(os.getuid())
try:
    open('/usr/local/bin/python3', 'w')
    print('changed python3')
except PermissionError:
    print('blocked')`);
    expect(stdout).toBe('1000\nblocked\n');
  });

  test('has no network access', async () => {
    const { stdout } = await python(`
import socket
try:
    socket.create_connection(('1.1.1.1', 80), timeout=2); print('online')
except OSError:
    print('offline')`);
    expect(stdout).toBe('offline\n');
  });

  test('nothing one run leaves behind reaches the next run', async () => {
    await python(`
import subprocess
subprocess.Popen(['sh', '-c', 'sleep 300'], start_new_session=True)
open('/workspace/.secret', 'w').write('x')
open('/tmp/left', 'w').write('x')`);

    for (let i = 0; i < 3; i++) {
      const { stdout } = await python(`
import os
procs = ' '.join(open(f'/proc/{p}/cmdline').read().replace('\\0', ' ') for p in os.listdir('/proc') if p.isdigit())
print('sleep 300' in procs, os.path.exists('/workspace/.secret'), os.path.exists('/tmp/left'))`);
      expect(stdout).toBe('False False False\n');
    }
  });

  test('a fork bomb is stopped by the process limit', async () => {
    const { stdout } = await python(`
import os, time
try:
    while True:
        if os.fork() == 0:
            time.sleep(30)
except OSError:
    print('stopped')`);
    expect(stdout).toContain('stopped');
    expect((await python('print("still fine")')).stdout).toBe('still fine\n');
  });

  test('an endless loop is stopped, keeping what it printed', async () => {
    const result = await python('print("start", flush=True)\nwhile True: pass');
    expect(result.stdout).toBe('start\n');
    expect(result.stderr).toMatch(/over 5 seconds/);
  });

  test('endless printing is cut off at 64 KB', async () => {
    const result = await python('while True: print("spam" * 100)');
    expect(result.stderr).toMatch(/Output truncated/);
    expect(result.stdout.length + result.stderr.length).toBeLessThan(66 * 1024);
  });

  test('using too much memory is stopped', async () => {
    const result = await python('x = bytearray(400 * 1024 * 1024)\nprint("allocated")');
    expect(result.stdout).not.toContain('allocated');
    expect(result.stderr).toMatch(/memory|MemoryError/);
  });

  test('files over 10 MB cannot be written', async () => {
    const result = await python('open("/workspace/big", "wb").write(b"x" * 20 * 1024 * 1024)\nprint("wrote")');
    expect(result.stdout).not.toContain('wrote');
    expect(result.stderr).toMatch(/File too large/);
  });

  test('many runs at once never start more than 4 containers, and the rest are told the server is busy', async () => {
    let most = 0;
    const watcher = setInterval(() => { most = Math.max(most, runningContainers()); }, 200);
    const results = await Promise.all(Array.from({ length: 10 }, () => python('import time; time.sleep(4); print("done")')));
    clearInterval(watcher);

    expect(results.filter((r) => r && r.stdout === 'done\n').length).toBeGreaterThanOrEqual(4);
    expect(results.filter((r) => r === null).length).toBeGreaterThanOrEqual(1);
    expect(most).toBeLessThanOrEqual(4);
  }, 60000);
});
