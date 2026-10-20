"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { io: connect } = require("socket.io-client");
const { createServer } = require("../server/server.js");

function emit(socket, event, payload = {}) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

function nextRollSnapshot(socket) {
  return new Promise(resolve => {
    const listener = room => {
      if (!room.rolls.length) return;
      socket.off("room:snapshot", listener);
      resolve(room);
    };
    socket.on("room:snapshot", listener);
  });
}

test("two browser clients receive the same server-generated roll", async t => {
  const instance = createServer({ rng: () => 6 });
  await new Promise(resolve => instance.server.listen(0, "127.0.0.1", resolve));
  const { port } = instance.server.address();
  const host = connect(`http://127.0.0.1:${port}`, { transports: ["websocket"] });
  const player = connect(`http://127.0.0.1:${port}`, { transports: ["websocket"] });
  t.after(() => {
    host.close();
    player.close();
    instance.io.close();
  });
  await Promise.all([
    new Promise(resolve => host.once("connect", resolve)),
    new Promise(resolve => player.once("connect", resolve)),
  ]);

  const created = await emit(host, "room:create", { displayName: "Nova" });
  assert.equal(created.ok, true);
  const joined = await emit(player, "room:join", { roomCode: created.session.roomCode, displayName: "Magi" });
  assert.equal(joined.ok, true);

  const hostUpdate = nextRollSnapshot(host);
  const playerUpdate = nextRollSnapshot(player);
  const rolled = await emit(player, "roll:request", { type: "2d10", bonus: 0, count: 1 });
  assert.equal(rolled.ok, true);
  const [hostRoom, playerRoom] = await Promise.all([hostUpdate, playerUpdate]);
  assert.deepEqual(hostRoom.rolls, playerRoom.rolls);
  assert.equal(hostRoom.rolls[0].playerName, "Magi");
  assert.equal(hostRoom.rolls[0].result, "Critical Success");
});
