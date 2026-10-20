"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { RoomManager } = require("../server/room-manager.js");

test("players create and join a shared room", () => {
  const manager = new RoomManager({ rng: () => 4 });
  const created = manager.create("host-socket", { displayName: "Nova" });
  const joined = manager.join("player-socket", { roomCode: created.room.code.toLowerCase(), displayName: "Magi" });
  assert.equal(joined.room.players.size, 2);
  assert.equal(manager.snapshot(joined.room).players[1].displayName, "Magi");
});

test("server owns rolls and broadcasts shared history data", () => {
  const manager = new RoomManager({ rng: () => 6 });
  const { room } = manager.create("host-socket", { displayName: "Nova" });
  const result = manager.roll("host-socket", { type: "2d10", bonus: 0, count: 1 });
  assert.equal(result.rolls[0].result, "Critical Success");
  assert.equal(result.rolls[0].playerName, "Nova");
  assert.equal(manager.snapshot(room).rolls.length, 1);
});

test("a reconnect token restores the same player", () => {
  const manager = new RoomManager();
  const created = manager.create("first-socket", { displayName: "Nova" });
  manager.disconnect("first-socket");
  const restored = manager.reconnect("second-socket", created.session);
  assert.equal(restored.room.players.size, 1);
  assert.equal(manager.snapshot(restored.room).players[0].connected, true);
});

test("only the host can clear history", () => {
  const manager = new RoomManager({ rng: () => 4 });
  const created = manager.create("host-socket", { displayName: "Nova" });
  manager.join("player-socket", { roomCode: created.room.code, displayName: "Magi" });
  manager.roll("host-socket", { type: "d6", bonus: 0, count: 1 });
  assert.throws(() => manager.clear("player-socket"), /Only the host/);
  manager.clear("host-socket");
  assert.equal(created.room.rolls.length, 0);
});
