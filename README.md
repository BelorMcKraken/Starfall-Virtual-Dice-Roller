# Starfall Web Dice Roller

This is the new, independent web version of the Starfall dice roller. The original
Python/Tkinter desktop application remains untouched in the parent folder.

## Current milestone

- Responsive desktop and mobile interface
- Create a room with a short crew code
- Join a room from another browser or device
- Live player presence and shared roll history
- Server-authoritative 2d10, utility-die, batch, and initiative rolls
- Automatic reconnection in the same browser
- Host-only history clearing
- Render deployment configuration and health endpoint

Rooms currently live in server memory. A Render restart or deployment clears them.
Durable room storage is intentionally deferred until we decide how long sessions
should survive and whether accounts are needed.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm install
npm test
npm start
```

Open `http://localhost:3000`. To test multiplayer, create a room in one browser
window and join its code from a private/incognito window or another device on the
same network.

## Deploy to Render

Create a new Render Blueprint from this folder/repository. `render.yaml` configures
the Node service, health check, and start command. Socket.IO uses the same web
service and requires no separate process for this initial single-instance version.

## Planned next milestones

1. Persistent rooms and roll history.
2. Host controls, player removal, and optional room passwords.
3. Participant rosters and named character/monster actors.
4. Installable PWA behavior for phones.
5. Native mobile packaging after the web experience is stable.
