"use strict";

const { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } = require("node:crypto");
const { makeRoll } = require("./rules.js");

const WORDS = ["NOVA", "COMET", "ORBIT", "PULSAR", "QUASAR", "NEBULA"];
const MAX_PLAYERS = 12;
const MAX_HISTORY = 250;
const hash = token => createHash("sha256").update(token).digest();

class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function cleanText(value, label, max = 40) {
  if (typeof value !== "string") throw new RoomError("INVALID_INPUT", `${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > max) throw new RoomError("INVALID_INPUT", `${label} must be 1–${max} characters.`);
  return clean;
}

class RoomManager {
  constructor({ rng } = {}) {
    this.rooms = new Map();
    this.connections = new Map();
    this.rng = rng;
  }

  newCode() {
    let code;
    do code = `${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 10000)}`;
    while (this.rooms.has(code));
    return code;
  }

  room(code) {
    const normalized = cleanText(code, "Room code", 20).toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", "Room not found. Check the code and try again.");
    return room;
  }

  addPlayer(room, socketId, displayName, role) {
    const token = randomBytes(32).toString("hex");
    const player = { id: randomUUID(), displayName, role, connected: true, socketId, tokenHash: hash(token) };
    room.players.set(player.id, player);
    this.connections.set(socketId, { roomCode: room.code, playerId: player.id });
    return { player, session: { roomCode: room.code, playerId: player.id, reconnectToken: token } };
  }

  ensureAvailable(socketId) {
    if (this.connections.has(socketId)) throw new RoomError("ALREADY_JOINED", "Leave your current room first.");
  }

  create(socketId, payload = {}) {
    this.ensureAvailable(socketId);
    const displayName = cleanText(payload.displayName, "Display name");
    const room = { code: this.newCode(), hostPlayerId: null, players: new Map(), rolls: [], createdAt: new Date().toISOString() };
    const identity = this.addPlayer(room, socketId, displayName, "HOST");
    room.hostPlayerId = identity.player.id;
    this.rooms.set(room.code, room);
    return { room, session: identity.session };
  }

  join(socketId, payload = {}) {
    this.ensureAvailable(socketId);
    const room = this.room(payload.roomCode);
    if (room.players.size >= MAX_PLAYERS) throw new RoomError("ROOM_FULL", `This room already has ${MAX_PLAYERS} players.`);
    const displayName = cleanText(payload.displayName, "Display name");
    const identity = this.addPlayer(room, socketId, displayName, "PLAYER");
    return { room, session: identity.session };
  }

  reconnect(socketId, payload = {}) {
    this.ensureAvailable(socketId);
    const room = this.room(payload.roomCode);
    const player = room.players.get(payload.playerId);
    const token = payload.reconnectToken;
    if (!player || typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(player.tokenHash, hash(token))) {
      throw new RoomError("INVALID_SESSION", "The saved room session is no longer valid.");
    }
    if (player.socketId) this.connections.delete(player.socketId);
    player.socketId = socketId;
    player.connected = true;
    this.connections.set(socketId, { roomCode: room.code, playerId: player.id });
    return { room, session: payload };
  }

  authorize(socketId) {
    const binding = this.connections.get(socketId);
    const room = binding && this.rooms.get(binding.roomCode);
    const player = room && room.players.get(binding.playerId);
    if (!player || player.socketId !== socketId || !player.connected) throw new RoomError("INVALID_SESSION", "Join a room before rolling.");
    return { room, player };
  }

  roll(socketId, payload) {
    const { room, player } = this.authorize(socketId);
    let rolls;
    try { rolls = makeRoll(payload, this.rng); }
    catch (error) { throw new RoomError("INVALID_ROLL", error.message); }
    for (const roll of rolls) {
      roll.playerId = player.id;
      roll.playerName = player.displayName;
    }
    room.rolls.push(...rolls);
    room.rolls = room.rolls.slice(-MAX_HISTORY);
    return { room, rolls };
  }

  clear(socketId) {
    const { room, player } = this.authorize(socketId);
    if (player.id !== room.hostPlayerId) throw new RoomError("HOST_REQUIRED", "Only the host can clear room history.");
    room.rolls = [];
    return room;
  }

  disconnect(socketId) {
    const binding = this.connections.get(socketId);
    if (!binding) return null;
    this.connections.delete(socketId);
    const room = this.rooms.get(binding.roomCode);
    const player = room && room.players.get(binding.playerId);
    if (!player || player.socketId !== socketId) return null;
    player.connected = false;
    player.socketId = null;
    return room;
  }

  snapshot(room) {
    return {
      code: room.code, hostPlayerId: room.hostPlayerId, createdAt: room.createdAt,
      players: [...room.players.values()].map(({ id, displayName, role, connected }) => ({ id, displayName, role, connected })),
      rolls: room.rolls,
    };
  }
}

module.exports = { MAX_HISTORY, MAX_PLAYERS, RoomError, RoomManager };
