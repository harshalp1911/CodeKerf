// Who can do what in a room. Roles come from the database, so a client can't claim one.
const { startServer, sleep, waitFor } = require('./helpers');

let server;
let owner, editor, viewer, stranger;
let room, otherRoom;
let ownerSocket;

const join = (socket, roomId) => server.request(socket, 'joinRoom', { roomId }, ['roomState', 'roomError']);
const roomCode = async (roomId) => (await server.api('GET', `/api/rooms/${roomId}`, { token: owner.token })).body.code;

beforeAll(async () => {
  server = await startServer();
  [owner, editor, viewer, stranger] = await Promise.all(
    ['Owner Person', 'Editor Person', 'Viewer Person', 'Stranger Person'].map(server.register)
  );
  room = (await server.api('POST', '/api/rooms', { token: owner.token, body: { name: 'Test room' } })).body;
  otherRoom = (await server.api('POST', '/api/rooms', { token: owner.token, body: { name: 'Other room' } })).body;
  for (const [person, role] of [[editor, 'editor'], [viewer, 'viewer']]) {
    await server.api('POST', `/api/rooms/${room._id}/members/invite`, {
      token: owner.token, body: { email: person.user.email, role }
    });
  }
  ownerSocket = await server.connect({ token: owner.token });
  await join(ownerSocket, room._id);
});

afterAll(() => server.close());

describe('accounts', () => {
  test('/me never returns the password hash', async () => {
    const me = await server.api('GET', '/api/auth/me', { token: owner.token });
    expect(me.status).toBe(200);
    expect(me.body.password).toBeUndefined();
  });

  test('a socket with an invalid token is rejected', async () => {
    await expect(server.connect({ token: 'not-a-real-token' })).rejects.toThrow('Authentication error');
  });
});

describe('room access', () => {
  test('a logged-out socket cannot join or edit a room', async () => {
    const anon = await server.connect();
    anon.emit('codeChange', { roomId: room._id, code: 'hacked by anon' });
    anon.emit('codeChange', null);
    const res = await join(anon, room._id);
    expect(res.event).toBe('roomError');
    expect(await roomCode(room._id)).toBe('');
  });

  test('a non-member cannot join, edit or chat', async () => {
    const socket = await server.connect({ token: stranger.token });
    expect((await join(socket, room._id)).event).toBe('roomError');
    socket.emit('codeChange', { roomId: room._id, code: 'hacked by stranger' });
    socket.emit('sendMessage', { roomId: room._id, message: 'spam' });
    await sleep(300);
    expect(await roomCode(room._id)).toBe('');
    expect(ownerSocket.received('newMessage')).toBe(false);
  });

  test('a viewer joins read-only', async () => {
    const socket = await server.connect({ token: viewer.token });
    const res = await join(socket, room._id);
    expect(res.payload.role).toBe('viewer');
    socket.emit('codeChange', { roomId: room._id, code: 'hacked by viewer' });
    await sleep(300);
    expect(await roomCode(room._id)).toBe('');
  });

  test("an editor's changes are saved and reach the others", async () => {
    const socket = await server.connect({ token: editor.token });
    expect((await join(socket, room._id)).payload.role).toBe('editor');
    socket.emit('codeChange', { roomId: room._id, code: 'print(1)' });
    await waitFor(() => ownerSocket.received('codeUpdate', (code) => code === 'print(1)'));
    await waitFor(async () => (await roomCode(room._id)) === 'print(1)');
  });

  test('an editor cannot write to a room they have not joined', async () => {
    const socket = await server.connect({ token: editor.token });
    await join(socket, room._id);
    socket.emit('codeChange', { roomId: otherRoom._id, code: 'cross-room write' });
    await sleep(300);
    expect(await roomCode(otherRoom._id)).toBe('');
  });
});

describe('chat', () => {
  test('typing indicators use the real identity, not names sent by the client', async () => {
    const socket = await server.connect({ token: editor.token });
    await join(socket, room._id);
    socket.emit('typing', { roomId: room._id, userId: owner.user.id, userName: 'Fake Name' });
    const typing = await waitFor(() => ownerSocket.events.find((e) => e.event === 'userTyping'));
    expect(typing.args[0].userName).toBe('Editor Person');
  });

  test('member messages are trimmed and never include password hashes', async () => {
    const socket = await server.connect({ token: viewer.token });
    await join(socket, room._id);
    socket.emit('sendMessage', { roomId: room._id, message: '  hello from viewer  ' });
    const msg = await waitFor(() => ownerSocket.events.find((e) => e.event === 'newMessage'));
    expect(msg.args[0].message).toBe('hello from viewer');
    expect(msg.args[0].userId.password).toBeUndefined();
  });
});

describe('role changes apply to open tabs straight away', () => {
  test('a demoted editor loses edit access without a refresh', async () => {
    const socket = await server.connect({ token: editor.token });
    await join(socket, room._id);
    await server.api('PUT', `/api/rooms/${room._id}/members/${editor.user.id}`, { token: owner.token, body: { role: 'viewer' } });
    await waitFor(() => socket.received('roomAccessChanged', (data) => data.removed === false));

    socket.emit('codeChange', { roomId: room._id, code: 'after demotion' });
    await sleep(300);
    expect(await roomCode(room._id)).toBe('print(1)');

    expect((await join(socket, room._id)).payload.role).toBe('viewer');
    socket.emit('codeChange', { roomId: room._id, code: 'after rejoin' });
    await sleep(300);
    expect(await roomCode(room._id)).toBe('print(1)');
  });

  test('a removed member is cut off and cannot rejoin', async () => {
    const socket = await server.connect({ token: viewer.token });
    await join(socket, room._id);
    await server.api('DELETE', `/api/rooms/${room._id}/members/${viewer.user.id}`, { token: owner.token });
    await waitFor(() => socket.received('roomAccessChanged', (data) => data.removed === true));

    const before = ownerSocket.events.filter((e) => e.event === 'newMessage').length;
    socket.emit('sendMessage', { roomId: room._id, message: 'still here?' });
    await sleep(300);
    expect(ownerSocket.events.filter((e) => e.event === 'newMessage').length).toBe(before);
    expect((await join(socket, room._id)).event).toBe('roomError');
  });
});
