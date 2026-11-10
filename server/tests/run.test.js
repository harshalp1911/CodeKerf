// POST /api/run: input checks, the per-user rate limit and the "server busy" answer.
// Docker is replaced by a fake runner here; tests/sandbox.test.js covers the real containers.
const { startServer } = require('./helpers');

let server;
let busy = false;
const runner = { run: async (language, code) => (busy ? null : { stdout: `ran ${language}: ${code}`, stderr: '' }) };

let ipCount = 0;
const newIp = () => `10.0.0.${++ipCount}`;
const run = (body, options = {}) => server.api('POST', '/api/run', { ip: newIp(), ...options, body });
const python = { language: 'python', code: 'print(1)' };

beforeAll(async () => {
  process.env.TRUST_PROXY = '1'; // lets each test act as a different visitor through X-Forwarded-For
  server = await startServer({ runner });
});

afterAll(async () => {
  delete process.env.TRUST_PROXY;
  await server.close();
});

describe('input checks', () => {
  test('runs supported code', async () => {
    const res = await run(python);
    expect(res.status).toBe(200);
    expect(res.body.stdout).toBe('ran python: print(1)');
  });

  test.each([
    ['an unsupported language', { language: 'ruby', code: 'puts 1' }, /Unsupported/],
    ['code over 100 KB', { language: 'python', code: 'x'.repeat(101 * 1024) }, /100 KB/],
    ['input over 64 KB', { language: 'python', code: 'x', stdin: 'x'.repeat(65 * 1024) }, /64 KB/],
    ['code that is not text', { language: 'python', code: { not: 'a string' } }, /100 KB/]
  ])('rejects %s with a clear message', async (_name, body, message) => {
    const res = await run(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });
});

describe('rate limit', () => {
  test('a guest gets 10 runs a minute, then 429 with a wait time', async () => {
    const ip = newIp();
    for (let i = 0; i < 10; i++) expect((await run(python, { ip })).status).toBe(200);

    const blocked = await run(python, { ip });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(blocked.body.error).toMatch(/try again in \d+ seconds/);
  });

  test('one guest hitting the limit does not affect another', async () => {
    const ip = newIp();
    for (let i = 0; i < 11; i++) await run(python, { ip });
    expect((await run(python)).status).toBe(200);
  });

  test('a fake token does not get around the guest limit', async () => {
    const ip = newIp();
    for (let i = 0; i < 10; i++) await run(python, { ip });
    expect((await run(python, { ip, token: 'not-a-real-token' })).status).toBe(429);
  });

  test('a logged-in user gets 30 runs a minute, counted by account and not by IP', async () => {
    const { token } = await server.register('Runner User');
    for (let i = 0; i < 30; i++) expect((await run(python, { token })).status).toBe(200); // a new IP each time
    expect((await run(python, { token })).status).toBe(429);
  });

  test('the window resets once its counter expires', async () => {
    const ip = newIp();
    for (let i = 0; i < 11; i++) await run(python, { ip });
    await server.redis.del(`runlimit:ip:${ip}`); // what Redis does itself after 60 seconds
    expect((await run(python, { ip })).status).toBe(200);
  });
});

test('answers 503 when every container stays busy', async () => {
  busy = true;
  const res = await run(python);
  busy = false;
  expect(res.status).toBe(503);
  expect(res.body.error).toMatch(/busy/);
});
