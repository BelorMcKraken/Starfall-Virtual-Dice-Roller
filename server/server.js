"use strict";

const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { RoomManager, RoomError } = require("./room-manager.js");

function createServer(options = {}) {
  const app = express();
  app.disable("x-powered-by");
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 64 * 1024 });
  const manager = new RoomManager(options);
  const publicDir = path.resolve(__dirname, "..", "public");

  app.use(express.static(publicDir, { index: "index.html" }));
  app.get("/health", (_, response) => response.json({ ok: true, service: "starfall-dice-roller" }));

  const respond = (socket, callback, operation) => {
    try { callback({ ok: true, ...operation() }); }
    catch (error) {
      const known = error instanceof RoomError;
      callback({ ok: false, code: known ? error.code : "SERVER_ERROR", message: known ? error.message : "Something went wrong." });
    }
  };
  const broadcast = room => io.to(room.code).emit("room:snapshot", manager.snapshot(room));

  io.on("connection", socket => {
    socket.on("room:create", (payload, callback = () => {}) => respond(socket, callback, () => {
      const { room, session } = manager.create(socket.id, payload);
      socket.join(room.code);
      broadcast(room);
      return { session, snapshot: manager.snapshot(room) };
    }));
    socket.on("room:join", (payload, callback = () => {}) => respond(socket, callback, () => {
      const { room, session } = manager.join(socket.id, payload);
      socket.join(room.code);
      broadcast(room);
      return { session, snapshot: manager.snapshot(room) };
    }));
    socket.on("room:reconnect", (payload, callback = () => {}) => respond(socket, callback, () => {
      const { room, session } = manager.reconnect(socket.id, payload);
      socket.join(room.code);
      broadcast(room);
      return { session, snapshot: manager.snapshot(room) };
    }));
    socket.on("roll:request", (payload, callback = () => {}) => respond(socket, callback, () => {
      const { room, rolls } = manager.roll(socket.id, payload);
      broadcast(room);
      return { rolls };
    }));
    socket.on("history:clear", (_, callback = () => {}) => respond(socket, callback, () => {
      const room = manager.clear(socket.id);
      broadcast(room);
      return {};
    }));
    socket.on("disconnect", () => {
      const room = manager.disconnect(socket.id);
      if (room) broadcast(room);
    });
  });
  return { app, server, io, manager };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  const { server } = createServer();
  server.listen(port, "0.0.0.0", () => console.log(`Starfall web dice roller: http://localhost:${port}`));
}

module.exports = { createServer };
