// One-time share links: whoever opens a link first claims it, and nobody else can use it.
const crypto = require('crypto');
const { startServer, sleep, waitFor } = require('./helpers');
const Share = require('../models/Share');

let server;
const guestKey = () => crypto.randomUUID();

const open = (socket, token) => server.request(socket, 'joinShare', { token }, ['shareState', 'shareError']);
const createShare = (who, body) => server.api('POST', '/api/shares', { ...who, body });

beforeAll(async () => {
  server = await startServer();
});

afterAll(() => server.close());

describe('creating links', () => {
  test('a guest can create one viewer link with an unguessable token', async () => {
    const guest = guestKey();
    const res = await createShare({ guest }, { role: 'viewer', code: 'x', language: 'python' });
    expect(res.status).toBe(201);
    expect(res.body.share.role).toBe('viewer');
    expect(res.body.share.token.length).toBeGreaterThanOrEqual(20);
    expect(res.body.share.token).not.toMatch(/^[0-9a-f]{24}$/); // not a database ID

    const again = await createShare({ guest }, { role: 'viewer', code: 'other' });
    expect(again.status).toBe(200);
    expect(again.body.share.token).toBe(res.body.share.token);
  });

  test('guests cannot create editor links or stop sharing', async () => {
    expect((await createShare({ guest: guestKey() }, { role: 'editor' })).status).toBe(403);
    const guest = guestKey();
    await createShare({ guest }, { role: 'viewer' });
    expect((await server.api('DELETE', '/api/shares/mine', { guest })).status).toBe(403);
  });

  test('a request without a valid identity is rejected', async () => {
    expect((await createShare({ guest: 'not-a-uuid' }, { role: 'viewer' })).status).toBe(400);
  });

  test('a double click creates one link, not two', async () => {
    const guest = guestKey();
    const [a, b] = await Promise.all([1, 2].map(() => createShare({ guest }, { role: 'viewer' })));
    expect(a.body.share.token).toBe(b.body.share.token);
    expect(await Share.countDocuments({ ownerGuestKey: guest })).toBe(1);
  });

  test('different guests can all share at the same time', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => createShare({ guest: guestKey() }, { role: 'viewer' })));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
  });
});

describe('a guest viewer link', () => {
  const ownerKey = guestKey();
  const viewerKey = guestKey();
  let token, ownerSocket, viewerSocket;

  beforeAll(async () => {
    token = (await createShare({ guest: ownerKey }, { role: 'viewer', code: 'print("hi")', language: 'python' })).body.share.token;
    ownerSocket = await server.connect({ guest: ownerKey });
  });

  test('the owner can reopen their own link', async () => {
    const res = await open(ownerSocket, token);
    expect(res.payload).toMatchObject({ role: 'owner', claimed: false });
  });

  test('the first person to open it gets in as a viewer, and the owner is told', async () => {
    viewerSocket = await server.connect({ guest: viewerKey });
    const res = await open(viewerSocket, token);
    expect(res.payload).toMatchObject({ role: 'viewer', code: 'print("hi")' });
    await waitFor(() => ownerSocket.received('shareJoined'));
  });

  test('everyone else is refused, logged in or not', async () => {
    const guest = await server.connect({ guest: guestKey() });
    expect((await open(guest, token)).payload.code).toBe('INVALID');
    const user = await server.connect({ token: (await server.register('Dana User')).token, guest: guestKey() });
    expect((await open(user, token)).event).toBe('shareError');
  });

  test('the viewer can come back in the same browser, but not from another one', async () => {
    expect((await open(await server.connect({ guest: viewerKey }), token)).payload.role).toBe('viewer');
    expect((await open(await server.connect({ guest: guestKey() }), token)).event).toBe('shareError');
  });

  test('the viewer cannot change the code', async () => {
    viewerSocket.emit('codeChange', { roomId: token, code: 'hacked by viewer' });
    await sleep(300);
    expect((await Share.findOne({ token })).code).toBe('print("hi")');
    expect(ownerSocket.received('codeUpdate')).toBe(false);
  });

  test("the owner's edits and run output reach the viewer live and are saved", async () => {
    ownerSocket.emit('codeChange', { roomId: token, code: 'print("live")' });
    ownerSocket.emit('runResult', { roomId: token, stdout: 'live\n', stderr: '' });
    await waitFor(() => viewerSocket.received('codeUpdate', (code) => code === 'print("live")'));
    await waitFor(() => viewerSocket.received('runResult', (r) => r.stdout === 'live\n'));
    await waitFor(async () => (await Share.findOne({ token })).code === 'print("live")');
  });
});

describe('a logged-in editor link', () => {
  let ownerUser, editorUser, token, ownerSocket, editorSocket;

  beforeAll(async () => {
    ownerUser = await server.register('Erin Owner');
    editorUser = await server.register('Gil Editor');
    const res = await createShare({ token: ownerUser.token }, { role: 'editor', code: 'int main(){}', language: 'cpp' });
    token = res.body.share.token;
    ownerSocket = await server.connect({ token: ownerUser.token });
    await open(ownerSocket, token);
  });

  test('a guest is asked to log in, without using up the link', async () => {
    const res = await open(await server.connect({ guest: guestKey() }), token);
    expect(res.payload.code).toBe('LOGIN_REQUIRED');
    expect((await Share.findOne({ token })).claimedBy).toBeNull();
  });

  test('a logged-in user claims it, and their edits reach the owner and are saved', async () => {
    editorSocket = await server.connect({ token: editorUser.token });
    expect((await open(editorSocket, token)).payload.role).toBe('editor');

    editorSocket.emit('codeChange', { roomId: token, code: 'int main(){ return 1; }' });
    editorSocket.emit('languageChange', { roomId: token, language: 'java' });
    editorSocket.emit('runResult', { roomId: token, stdout: '', stderr: 'compile error' });
    await waitFor(() => ownerSocket.received('codeUpdate', (code) => code === 'int main(){ return 1; }'));
    await waitFor(() => ownerSocket.received('languageUpdate', (lang) => lang === 'java'));
    await waitFor(() => ownerSocket.received('runResult', (r) => r.stderr === 'compile error'));
    await waitFor(async () => {
      const saved = await Share.findOne({ token });
      return saved.code === 'int main(){ return 1; }' && saved.language === 'java';
    });
  });

  test('the link follows the account to another browser, and refuses other accounts', async () => {
    expect((await open(await server.connect({ token: editorUser.token, guest: guestKey() }), token)).payload.role).toBe('editor');
    const other = await server.connect({ token: (await server.register('Hal Other')).token });
    expect((await open(other, token)).payload.code).toBe('INVALID');
  });

  test('share links have no chat or whiteboard', async () => {
    editorSocket.emit('sendMessage', { roomId: token, message: 'chat?' });
    editorSocket.emit('whiteboardDraw', { roomId: token, element: { id: 'x', type: 'rect' } });
    await sleep(300);
    expect(ownerSocket.received('newMessage') || ownerSocket.received('whiteboardUpdate')).toBe(false);
  });

  test('stopping the share cuts the other person off, and the owner can share again', async () => {
    expect((await server.api('DELETE', '/api/shares/mine', { token: ownerUser.token })).status).toBe(200);
    await waitFor(() => editorSocket.received('shareEnded'));

    editorSocket.emit('codeChange', { roomId: token, code: 'after stop' });
    await sleep(300);
    expect(ownerSocket.received('codeUpdate', (code) => code === 'after stop')).toBe(false);
    expect((await open(await server.connect({ token: editorUser.token }), token)).event).toBe('shareError');

    const again = await createShare({ token: ownerUser.token }, { role: 'viewer' });
    expect(again.status).toBe(201);
    expect(again.body.share.token).not.toBe(token);
  });
});

describe('races and expiry', () => {
  test('when 8 people open a link at the same moment, exactly one gets in', async () => {
    const token = (await createShare({ guest: guestKey() }, { role: 'viewer', code: 'race' })).body.share.token;
    const sockets = await Promise.all(Array.from({ length: 8 }, () => server.connect({ guest: guestKey() })));
    const results = await Promise.all(sockets.map((socket) => open(socket, token)));
    expect(results.filter((r) => r.event === 'shareState')).toHaveLength(1);
  });

  test('an expired link no longer opens, and the guest can share again', async () => {
    const guest = guestKey();
    const token = (await createShare({ guest }, { role: 'viewer' })).body.share.token;
    await Share.updateOne({ token }, { expiresAt: new Date(Date.now() - 1000) });

    expect((await open(await server.connect({ guest: guestKey() }), token)).event).toBe('shareError');
    const again = await createShare({ guest }, { role: 'viewer' });
    expect(again.status).toBe(201);
    expect(again.body.share.token).not.toBe(token);
  });
});
