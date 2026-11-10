// Rooms survive refreshes, keep their chat history and whiteboard, and only the owner can delete them.
const { startServer, sleep, waitFor } = require('./helpers');

let server;
let owner, editor, viewer;
let room;
let ownerSocket, editorSocket, viewerSocket;

const join = (socket, roomId) => server.request(socket, 'joinRoom', { roomId }, ['roomState', 'roomError']);
const board = (socket) => new Promise((resolve) => socket.emit('getWhiteboard', { roomId: room._id }, resolve));
const ids = (elements) => elements.map((e) => e.id).join(',');

beforeAll(async () => {
  server = await startServer();
  [owner, editor, viewer] = await Promise.all(['Owner Person', 'Editor Person', 'Viewer Person'].map(server.register));
  room = (await server.api('POST', '/api/rooms', { token: owner.token, body: { name: 'Rooms test' } })).body;
  for (const [person, role] of [[editor, 'editor'], [viewer, 'viewer']]) {
    await server.api('POST', `/api/rooms/${room._id}/members/invite`, {
      token: owner.token, body: { email: person.user.email, role }
    });
  }
});

afterAll(() => server.close());

test('the owner disconnecting does not delete the room', async () => {
  const socket = await server.connect({ token: owner.token });
  await join(socket, room._id);
  socket.disconnect();
  await sleep(300);
  expect((await server.api('GET', `/api/rooms/${room._id}`, { token: owner.token })).status).toBe(200);

  ownerSocket = await server.connect({ token: owner.token });
  expect((await join(ownerSocket, room._id)).payload.role).toBe('owner');
  editorSocket = await server.connect({ token: editor.token });
  viewerSocket = await server.connect({ token: viewer.token });
  await join(editorSocket, room._id);
  await join(viewerSocket, room._id);
});

test('joining a room loads its chat history in order', async () => {
  editorSocket.emit('sendMessage', { roomId: room._id, message: 'first' });
  await waitFor(() => ownerSocket.received('newMessage', (m) => m.message === 'first'));
  viewerSocket.emit('sendMessage', { roomId: room._id, message: 'second' });
  await waitFor(() => ownerSocket.received('newMessage', (m) => m.message === 'second'));

  const late = await server.connect({ token: owner.token });
  const { payload } = await join(late, room._id);
  expect(payload.messages.map((m) => m.message)).toEqual(['first', 'second']);
  expect(payload.messages[0].userId.name).toBe('Editor Person');
  expect(payload.messages.every((m) => m.userId.password === undefined)).toBe(true);
});

test('quick edits are saved in order, so the latest code is what stays', async () => {
  for (let i = 1; i <= 40; i++) editorSocket.emit('codeChange', { roomId: room._id, code: `version ${i}` });
  await waitFor(() => ownerSocket.received('codeUpdate', (code) => code === 'version 40'));
  await sleep(300);
  expect((await server.api('GET', `/api/rooms/${room._id}`, { token: owner.token })).body.code).toBe('version 40');
});

describe('whiteboard', () => {
  const rect = { id: 'rect-1', type: 'rect', left: 10, top: 10, width: 50, height: 50 };
  const line = { id: 'line-1', type: 'line', left: 5, top: 5 };

  test('drawings are saved and reach other members; viewers and objects without an id are refused', async () => {
    editorSocket.emit('whiteboardDraw', { roomId: room._id, element: rect });
    editorSocket.emit('whiteboardDraw', { roomId: room._id, element: line });
    editorSocket.emit('whiteboardDraw', { roomId: room._id, element: { type: 'rect', left: 0 } });
    viewerSocket.emit('whiteboardDraw', { roomId: room._id, element: { id: 'viewer-1', type: 'rect' } });
    await waitFor(() => ownerSocket.received('whiteboardUpdate', (el) => el.id === 'line-1'));
    await sleep(200);
    expect(ids((await board(ownerSocket)).elements)).toBe('rect-1,line-1');
  });

  test('many strokes drawn at once are all kept', async () => {
    const strokes = Array.from({ length: 30 }, (_, i) => ({ id: `burst-${i}`, type: 'path' }));
    strokes.forEach((element) => editorSocket.emit('whiteboardDraw', { roomId: room._id, element }));
    await waitFor(async () => (await board(ownerSocket)).elements.length === 32);
  });

  test('moving an object updates that object only', async () => {
    editorSocket.emit('whiteboardObjectModified', { roomId: room._id, element: { ...rect, left: 200 } });
    await waitFor(() => ownerSocket.received('whiteboardObjectModified', (data) => data.element.left === 200));
    const elements = await waitFor(async () => {
      const { elements: all } = await board(ownerSocket);
      return all.find((e) => e.id === 'rect-1').left === 200 && all;
    });
    expect(elements.find((e) => e.id === 'line-1').left).toBe(5);
  });

  test('deleting removes the right object, and viewers cannot delete', async () => {
    ownerSocket.emit('whiteboardObjectRemoved', { roomId: room._id, id: 'line-1' });
    viewerSocket.emit('whiteboardObjectRemoved', { roomId: room._id, id: 'rect-1' });
    await waitFor(() => editorSocket.received('whiteboardObjectRemoved', (data) => data.id === 'line-1'));
    await sleep(200);
    const { elements } = await board(ownerSocket);
    expect(elements.some((e) => e.id === 'line-1')).toBe(false);
    expect(elements.some((e) => e.id === 'rect-1')).toBe(true);
  });

  test('non-members cannot load the whiteboard', async () => {
    const outsider = await server.connect({ token: (await server.register('Outsider Person')).token });
    const res = await new Promise((resolve) => outsider.emit('getWhiteboard', { roomId: room._id }, resolve));
    expect(res.error).toBeDefined();
    expect(res.elements).toBeUndefined();
  });
});

describe('deleting a room', () => {
  test('only the owner can delete it', async () => {
    const res = await server.api('DELETE', `/api/rooms/${room._id}`, { token: editor.token });
    expect(res.status).toBe(403);
  });

  test('everyone inside is told, and the room and its whiteboard are gone', async () => {
    const res = await server.api('DELETE', `/api/rooms/${room._id}`, { token: owner.token });
    expect(res.status).toBe(200);
    await waitFor(() => editorSocket.received('roomDeleted') && viewerSocket.received('roomDeleted'));

    const gone = await server.api('GET', `/api/rooms/${room._id}`, { token: owner.token });
    expect([403, 404]).toContain(gone.status);
    expect((await board(editorSocket)).error).toBeDefined();
  });
});
