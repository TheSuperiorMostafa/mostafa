// server.js
// Simple private-room server for Multiplayer Trivia
// - HTTP API for creating & joining private rooms (6-digit codes)
// - WebSocket endpoint for realtime game messages
//
// Run: node server.js
//
// Note: This uses in-memory storage for rooms. Swap to Redis/DB for production.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Config
const PORT = process.env.PORT || 3000;
const ROOM_CODE_LENGTH = 6;
const ROOM_TTL_MS = 1000 * 60 * 60 * 24; // rooms expire after 24 hours by default
const MAX_ROOM_CREATION_ATTEMPTS = 5;
const DEFAULT_MAX_PLAYERS = 8;

// In-memory stores (replace with Redis/DB for production)
const rooms = new Map(); // code -> room object
// room object: {
//   code: "012345",
//   id: "<uuid or unique id>",
//   hostId: "<socketId or generated>",
//   players: [{ id, name, socket (if connected) }],
//   createdAt: Date,
//   expiresAt: Date,
//   maxPlayers,
//   isPublic: false
// }

// Helper: generate zero-padded code
function random6Digit() {
  const n = Math.floor(Math.random() * 1000000);
  return n.toString().padStart(ROOM_CODE_LENGTH, '0');
}

// Ensure uniqueness (for active rooms)
function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < MAX_ROOM_CREATION_ATTEMPTS; ++attempt) {
    const code = random6Digit();
    if (!rooms.has(code)) return code;
  }
  // fallback: linear search for unused code (unlikely to be needed)
  for (let i = 0; i < 1000000; ++i) {
    const code = i.toString().padStart(ROOM_CODE_LENGTH, '0');
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to generate unique room code');
}

// Periodic cleanup of expired rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.expiresAt <= now) {
      // close any leftover sockets nicely
      if (room.players) {
        for (const p of room.players) {
          if (p.socket && p.socket.readyState === WebSocket.OPEN) {
            try {
              p.socket.send(JSON.stringify({ type: 'room_expired', reason: 'Room expired' }));
              p.socket.close();
            } catch (e) { /* ignore */ }
          }
        }
      }
      rooms.delete(code);
      console.log(`Cleaned up expired room ${code}`);
    }
  }
}, 60 * 1000); // every minute

// Create a private room (called by website when "Create Private Room" button pressed)
app.post('/api/create-room', (req, res) => {
  try {
    // optional settings from client:
    // body: { maxPlayers: number, hostName: string, targetPoints: number }
    const maxPlayers = Number(req.body?.maxPlayers) || DEFAULT_MAX_PLAYERS;
    const hostName = String(req.body?.hostName || 'Host');
    const targetPoints = Number(req.body?.targetPoints) || 1000;

    const code = generateUniqueRoomCode();
    const now = Date.now();
    const room = {
      id: `${code}-${now}`, // simple unique id; replace with UUID if desired
      code,
      hostName,
      players: [], // players will be added upon WS join
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      maxPlayers,
      targetPoints,
      isPublic: false,
    };
    rooms.set(code, room);

    console.log(`Created private room ${code} (maxPlayers=${maxPlayers}, targetPoints=${targetPoints})`);

    res.json({
      ok: true,
      code,
      roomId: room.id,
      expiresAt: room.expiresAt,
      maxPlayers: room.maxPlayers,
      targetPoints: room.targetPoints
    });
  } catch (err) {
    console.error('create-room error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Join a room by code via HTTP (optional) - more typically the client uses WebSocket
app.post('/api/join-room', (req, res) => {
  try {
    // body: { code: "123456", playerName: "Alice" }
    const code = String(req.body?.code || '').padStart(ROOM_CODE_LENGTH, '0');
    const playerName = String(req.body?.playerName || 'Guest');

    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ ok: false, error: 'room_not_found' });
    }

    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ ok: false, error: 'room_full' });
    }

    // Note: actual player object & socket added upon WebSocket handshake.
    res.json({
      ok: true,
      code: room.code,
      roomId: room.id,
      maxPlayers: room.maxPlayers,
      currentPlayers: room.players.length
    });
  } catch (err) {
    console.error('join-room error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get room info (optional)
app.get('/api/room/:code', (req, res) => {
  const code = String(req.params.code || '').padStart(ROOM_CODE_LENGTH, '0');
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ ok: false, error: 'room_not_found' });
  res.json({
    ok: true,
    code: room.code,
    roomId: room.id,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    maxPlayers: room.maxPlayers,
    currentPlayers: room.players.map(p => ({ id: p.id, name: p.name })),
    isPublic: room.isPublic,
    targetPoints: room.targetPoints
  });
});

// Basic server + WebSocket setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Simple incremental id for players (per-server)
let nextPlayerId = 1;

// Message types (JSON) that server understands:
// From client:
//   { type: "join", code: "123456", name: "Alice" }
//   { type: "leave" }
//   { type: "chat", text: "hi" }
//   { type: "start_game" }  // host-only
//   { type: "submit_answer", choiceIndex: 1 }  // during active question
//   { type: "pick_category", category: "History" } // for private-room picker
//
// From server:
//   { type: "joined", playerId, code, players: [...] }
//   { type: "player_joined", player: {id,name} }
//   { type: "player_left", playerId }
//   { type: "error", message }
//   { type: "room_full" }
//   { type: "new_question", question: {...} }
//   { type: "round_end", results: {...} }
//   { type: "game_winner", playerId }
//
// The server acts as a relay / room manager. Game logic may be done server-side or delegated.
// For now the server does minimal checking and relays messages among clients in a room.

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // attach some per-socket metadata
  ws.meta = {
    playerId: null,
    playerName: null,
    roomCode: null
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
      return;
    }

    // Handle messages
    if (msg.type === 'join') {
      // Expect: { type: "join", code: "123456", name: "Alice" }
      const code = String(msg.code || '').padStart(ROOM_CODE_LENGTH, '0');
      const name = String(msg.name || `Player${nextPlayerId}`);
      const room = rooms.get(code);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'room_not_found' }));
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: 'room_full' }));
        return;
      }

      const player = {
        id: nextPlayerId++,
        name,
        socket: ws,
        joinedAt: Date.now(),
      };
      room.players.push(player);

      ws.meta.playerId = player.id;
      ws.meta.playerName = name;
      ws.meta.roomCode = code;

      // Notify this client
      ws.send(JSON.stringify({
        type: 'joined',
        playerId: player.id,
        code: room.code,
        roomId: room.id,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
        maxPlayers: room.maxPlayers,
        targetPoints: room.targetPoints
      }));

      // Broadcast to room everyone else that a player joined
      broadcastToRoom(code, {
        type: 'player_joined',
        player: { id: player.id, name: player.name }
      }, ws); // omit sender if desired

      console.log(`Player ${player.name} (id=${player.id}) joined room ${code}`);
      return;
    }

    if (msg.type === 'leave') {
      const code = ws.meta.roomCode;
      if (code) {
        removePlayerFromRoom(code, ws.meta.playerId);
      }
      ws.close();
      return;
    }

    // Other allowed message types require being in a room
    const code = ws.meta.roomCode;
    if (!code) {
      ws.send(JSON.stringify({ type: 'error', message: 'not_in_room' }));
      return;
    }

    // Relay chat messages and gameplay messages to everyone in room (basic)
    switch (msg.type) {
      case 'chat':
        broadcastToRoom(code, {
          type: 'chat',
          from: { id: ws.meta.playerId, name: ws.meta.playerName },
          text: String(msg.text || '')
        });
        break;

      case 'start_game':
        // Only host could be allowed to start; for simplicity allow anyone who sends request.
        broadcastToRoom(code, { type: 'start_game', initiatedBy: ws.meta.playerId });
        break;

      case 'new_question': // optional: server-side game logic can send this
        // Validate the structure minimally then broadcast
        broadcastToRoom(code, { type: 'new_question', question: msg.question });
        break;

      case 'submit_answer':
        // e.g., { type: 'submit_answer', choiceIndex: 1 }
        // You might want server to record these and perform scoring with game-logic module.
        broadcastToRoom(code, {
          type: 'submit_answer',
          from: ws.meta.playerId,
          choiceIndex: Number(msg.choiceIndex)
        });
        break;

      case 'pick_category':
        // e.g., { type: 'pick_category', category: 'History' }
        broadcastToRoom(code, {
          type: 'pick_category',
          by: ws.meta.playerId,
          category: String(msg.category)
        });
        break;

      // Add more message types as needed for game logic (e.g., ack, ping, player-ready)
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'unknown_message_type' }));
    }
  });

  ws.on('close', () => {
    const code = ws.meta?.roomCode;
    const pid = ws.meta?.playerId;
    if (code && pid) {
      removePlayerFromRoom(code, pid);
      console.log(`Player ${pid} disconnected from room ${code}`);
    }
  });

  ws.on('error', (err) => {
    console.warn('ws error', err);
  });
});

// broadcast helper
function broadcastToRoom(code, payload, omitSocket = null) {
  const room = rooms.get(code);
  if (!room) return;
  const raw = JSON.stringify(payload);
  for (const p of room.players) {
    if (!p.socket || p.socket.readyState !== WebSocket.OPEN) continue;
    if (omitSocket && p.socket === omitSocket) continue;
    try {
      p.socket.send(raw);
    } catch (e) {
      // ignore send errors
    }
  }
}

// remove player from room by id
function removePlayerFromRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return;
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx >= 0) {
    const [removed] = room.players.splice(idx, 1);
    // Close socket if still open
    if (removed.socket && removed.socket.readyState === WebSocket.OPEN) {
      try { removed.socket.send(JSON.stringify({ type: 'left' })); } catch {}
      // removed.socket.close(); // optional
    }
    broadcastToRoom(code, { type: 'player_left', playerId });
    // If room empty, optionally delete it:
    if (room.players.length === 0) {
      // set a short TTL or delete immediately
      // For now we delete immediately to avoid stale rooms still occupying codes
      rooms.delete(code);
      console.log(`Deleted empty room ${code}`);
    }
  }
}

// Basic ping/pong to detect dead connections (ws recommended practice)
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(function noop() {});
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
