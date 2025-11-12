const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const bcrypt = require('bcrypt');

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'game_auth',
    user: process.env.DB_USER || 'game_app_user',
    password: process.env.DB_PASSWORD || 'game_app_password',
});


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory rooms data
const rooms = {}; // { roomCode: { players: [{id, name}] } }

// Generate random 6-digit code
function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += Math.floor(Math.random() * 10);
    }
    return code;
}

// API to create a new room
app.post('/api/create-room', (req, res) => {
    let code = generateRoomCode();
    while (rooms[code]) {
        code = generateRoomCode(); // avoid duplicates
    }

    rooms[code] = { players: [] };
    res.json({ ok: true, code });

    console.log(`Room ${code} created.`);
});

// API to join a room (optional for initial fetch)
app.post('/api/join-room', (req, res) => {
    const { code, playerName } = req.body;
    if (!rooms[code]) {
        return res.status(404).json({ ok: false, error: 'Room not found.' });
    }
    res.json({ ok: true, code });
});

// Socket.IO connection
io.on('connection', (socket) => {
    socket.on('joinRoom', ({ code, playerName }) => {
        if (!rooms[code]) {
            rooms[code] = { players: [] };
        }

        // Check if room is full
        if (rooms[code].players.length >= 8) {
            socket.emit('joinError', 'Room is full.')
            return;
        }

        // Avoid duplicates
        if (!rooms[code].players.find(p => p.id === socket.id)) {
            rooms[code].players.push({ id: socket.id, name: playerName });
        }

        socket.join(code);

        // Broadcast updated players list to all clients in the room
        io.to(code).emit('updatePlayers', rooms[code].players);

        // Confirm join to client
        socket.emit('joinSuccess', { code, players: rooms[code].players });
    });

    socket.on('disconnect', () => {
        // Remove player from any room they were in
        for (const code in rooms) {
            const room = rooms[code];
            const index = room.players.findIndex(p => p.id === socket.id);

            if (index !== -1) {
                // Remove the player
                room.players.splice(index, 1);

                // Update all remaining clients in the room
                io.to(code).emit('updatePlayers', room.players);

                // If no players left, delete the room entirely
                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} closed (no players remaining)`);
                }

            break; // stop once we’ve found and removed the player
            }
        }
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Login existing users
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        // Find user in database
        const result = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE username = $1',
        [username]
    );

    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    // Compare password with stored hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Success
    res.json({ ok: true, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error('Database error on login:', err);
        res.status(500).json({ error: 'Database error' });
    }
});


// Register new users
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10); // 10 salt rounds

        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        res.json({ ok: true, user: result.rows[0] });
    } catch (err) {
        console.error('Database error on register:', err);
        res.status(500).json({ error: 'Database error' });
    }
});


