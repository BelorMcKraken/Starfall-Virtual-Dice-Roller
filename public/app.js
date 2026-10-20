"use strict";

const socket = io();
const $ = selector => document.querySelector(selector);
const sessionKey = "starfall-room-session-v1";
let session = null;
let snapshot = null;
let clickedAction = "create";

const elements = {
  lobby: $("#lobby"), room: $("#room"), form: $("#lobbyForm"), displayName: $("#displayName"),
  roomCode: $("#roomCode"), lobbyError: $("#lobbyError"), roomError: $("#roomError"),
  connection: $("#connectionStatus"), roomCodeDisplay: $("#roomCodeDisplay"), players: $("#players"),
  playerCount: $("#playerCount"), history: $("#rollHistory"), empty: $("#emptyHistory"),
  bonus: $("#bonus"), count: $("#rollCount"), clear: $("#clearHistory"), toast: $("#toast"),
};

for (let bonus = 0; bonus <= 10; bonus++) elements.bonus.add(new Option(`+${bonus}`, bonus));
const params = new URLSearchParams(location.search);
if (params.get("room")) elements.roomCode.value = params.get("room").toUpperCase();

function request(event, payload = {}) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

function saveSession(value) {
  session = value;
  if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
  else localStorage.removeItem(sessionKey);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function showRoom(room) {
  snapshot = room;
  elements.lobby.classList.add("hidden");
  elements.room.classList.remove("hidden");
  elements.roomCodeDisplay.textContent = room.code;
  elements.players.replaceChildren(...room.players.map(player => {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `player-dot ${player.connected ? "online" : ""}`;
    const name = document.createElement("span");
    name.textContent = player.displayName;
    li.append(dot, name);
    if (player.id === room.hostPlayerId) {
      const mark = document.createElement("span");
      mark.className = "host-mark";
      mark.textContent = "HOST";
      li.append(mark);
    }
    return li;
  }));
  elements.playerCount.textContent = `${room.players.filter(player => player.connected).length} online`;
  elements.clear.classList.toggle("hidden", session?.playerId !== room.hostPlayerId);
  renderHistory(room.rolls);
}

function formatMath(roll) {
  if (roll.type === "Initiative") return `Players ${roll.die1} · Monsters ${roll.die2}${roll.bonus ? ` · +${roll.bonus}` : ""}`;
  if (roll.type === "2d10") return `${roll.die1} + ${roll.die2}${roll.bonus ? ` + ${roll.bonus}` : ""}`;
  return `${roll.die1}${roll.bonus ? ` + ${roll.bonus}` : ""}`;
}

function renderHistory(rolls) {
  elements.empty.classList.toggle("hidden", rolls.length > 0);
  const newest = [...rolls].reverse();
  elements.history.replaceChildren(...newest.map(roll => {
    const li = document.createElement("li");
    const outcomeClass = /Failure/.test(roll.result) ? "failure" : /Success|Players Win/.test(roll.result) ? "success" : "";
    li.className = `roll-entry ${outcomeClass} ${roll.result.startsWith("Critical") ? "critical" : ""}`;
    const who = document.createElement("div");
    who.className = "roll-who";
    const whoStrong = document.createElement("strong");
    whoStrong.textContent = roll.playerName;
    const whoSmall = document.createElement("small");
    whoSmall.textContent = new Date(roll.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    who.append(whoStrong, whoSmall);
    const outcome = document.createElement("div");
    outcome.className = "roll-outcome";
    const outcomeStrong = document.createElement("strong");
    outcomeStrong.textContent = roll.result;
    const math = document.createElement("small");
    math.className = "roll-math";
    math.textContent = `${roll.type} · ${formatMath(roll)}`;
    outcome.append(outcomeStrong, math);
    const total = document.createElement("div");
    total.className = "roll-total";
    total.textContent = roll.total;
    li.append(who, outcome, total);
    return li;
  }));
}

document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => { clickedAction = button.dataset.action; }));
elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  elements.lobbyError.textContent = "";
  const payload = { displayName: elements.displayName.value };
  if (clickedAction === "join") payload.roomCode = elements.roomCode.value;
  const result = await request(clickedAction === "join" ? "room:join" : "room:create", payload);
  if (!result.ok) { elements.lobbyError.textContent = result.message; return; }
  saveSession(result.session);
  history.replaceState(null, "", `?room=${encodeURIComponent(result.session.roomCode)}`);
  showRoom(result.snapshot);
});

document.querySelectorAll("[data-roll]").forEach(button => button.addEventListener("click", async () => {
  elements.roomError.textContent = "";
  const type = button.dataset.roll;
  const result = await request("roll:request", { type, bonus: Number(elements.bonus.value), count: type === "Initiative" ? 1 : Number(elements.count.value) });
  if (!result.ok) elements.roomError.textContent = result.message;
}));

$("#copyCode").addEventListener("click", async () => { await navigator.clipboard.writeText(snapshot.code); showToast("Crew code copied"); });
$("#copyLink").addEventListener("click", async () => { await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${encodeURIComponent(snapshot.code)}`); showToast("Invite link copied"); });
$("#leaveRoom").addEventListener("click", () => { saveSession(null); location.href = location.pathname; });
elements.clear.addEventListener("click", async () => {
  if (!confirm("Clear the shared roll history for everyone?")) return;
  const result = await request("history:clear");
  if (!result.ok) elements.roomError.textContent = result.message;
});

socket.on("connect", async () => {
  elements.connection.className = "connection online";
  elements.connection.lastChild.textContent = " Connected";
  try { session = JSON.parse(localStorage.getItem(sessionKey)); } catch { session = null; }
  if (!session) return;
  const result = await request("room:reconnect", session);
  if (result.ok) { saveSession(result.session); showRoom(result.snapshot); }
  else saveSession(null);
});
socket.on("disconnect", () => {
  elements.connection.className = "connection offline";
  elements.connection.lastChild.textContent = " Reconnecting";
});
socket.on("room:snapshot", room => { if (session?.roomCode === room.code) showRoom(room); });
