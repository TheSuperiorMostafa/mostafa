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
// { roomCode: { 
//     players: [{id, name, score, ready}], 
//     gameState: 'lobby' | 'question' | 'results' | 'finished',
//     currentQuestion: {...},
//     questionIndex: 0,
//     answers: {socketId: 'A'|'B'|'C'|'D'},
//     questions: [...],
//     readyPlayers: Set of socketIds
// } }
const rooms = {};

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

    rooms[code] = { 
        players: [],
        gameState: 'lobby',
        currentQuestion: null,
        questionIndex: 0,
        answers: {},
        questions: [],
        scores: {},
        readyPlayers: new Set()
    };
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
            rooms[code] = { 
                players: [],
                gameState: 'lobby',
                currentQuestion: null,
                questionIndex: 0,
                answers: {},
                questions: [],
                scores: {},
                readyPlayers: new Set()
            };
        }

        // Check if room is full
        if (rooms[code].players.length >= 8) {
            socket.emit('joinError', 'Room is full.')
            return;
        }

        // Avoid duplicates
        if (!rooms[code].players.find(p => p.id === socket.id)) {
            rooms[code].players.push({ id: socket.id, name: playerName, score: 0, ready: false });
            // Initialize score for this player
            if (!rooms[code].scores) rooms[code].scores = {};
            rooms[code].scores[socket.id] = 0;
            if (!rooms[code].readyPlayers) rooms[code].readyPlayers = new Set();
        }

        socket.join(code);

        // Broadcast updated players list to all clients in the room
        const playersWithReady = rooms[code].players.map(p => ({
            ...p,
            ready: rooms[code].readyPlayers.has(p.id)
        }));
        io.to(code).emit('updatePlayers', playersWithReady);

        // Confirm join to client
        socket.emit('joinSuccess', { code, players: playersWithReady });
    });

    socket.on('leaveRoom', (code) => {
        const room = rooms[code];
        if (room) {
            const index = room.players.findIndex(p => p.id === socket.id);
            
            if (index !== -1) {
                room.players.splice(index, 1);
                
                socket.leave(code);

                // Remove from ready players
                if (room.readyPlayers) {
                    room.readyPlayers.delete(socket.id);
                }

                const playersWithReady = room.players.map(p => ({
                    ...p,
                    ready: room.readyPlayers.has(p.id)
                }));
                io.to(code).emit('updatePlayers', playersWithReady);

                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} closed (empty).`);
                }
            }
        }
    });
    
    socket.on('disconnect', () => {
        // Remove player from any room they were in
        for (const code in rooms) {
            const room = rooms[code];
            const index = room.players.findIndex(p => p.id === socket.id);

            if (index !== -1) {
                // Remove the player
                room.players.splice(index, 1);

                // Remove from ready players
                if (room.readyPlayers) {
                    room.readyPlayers.delete(socket.id);
                }

                // Update all remaining clients in the room
                const playersWithReady = room.players.map(p => ({
                    ...p,
                    ready: room.readyPlayers.has(p.id)
                }));
                io.to(code).emit('updatePlayers', playersWithReady);

                // If no players left, delete the room entirely
                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} closed (no players remaining)`);
                }

            break; // stop once we've found and removed the player
            }
        }
    });

    // Toggle ready status
    socket.on('toggleReady', ({ code }) => {
        const room = rooms[code];
        if (!room || room.gameState !== 'lobby') {
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        if (!room.readyPlayers) room.readyPlayers = new Set();

        if (room.readyPlayers.has(socket.id)) {
            room.readyPlayers.delete(socket.id);
            player.ready = false;
        } else {
            room.readyPlayers.add(socket.id);
            player.ready = true;
        }

        // Broadcast updated players list
        const playersWithReady = room.players.map(p => ({
            ...p,
            ready: room.readyPlayers.has(p.id)
        }));
        io.to(code).emit('updatePlayers', playersWithReady);
    });

    // Start game event
    socket.on('startGame', async ({ code }) => {
        const room = rooms[code];
        if (!room || room.gameState !== 'lobby') {
            socket.emit('gameError', 'Cannot start game.');
            return;
        }

        // Only host can start (first player)
        const isHost = room.players[0] && room.players[0].id === socket.id;
        if (!isHost) {
            socket.emit('gameError', 'Only the host can start the game.');
            return;
        }

        // Check if all players are ready (excluding host - host doesn't need to be ready)
        const nonHostPlayers = room.players.slice(1);
        if (nonHostPlayers.length > 0) {
            const allReady = nonHostPlayers.every(p => room.readyPlayers && room.readyPlayers.has(p.id));
            if (!allReady) {
                socket.emit('gameError', 'All players must be ready before starting the game.');
                return;
            }
        }

        try {
            // Fetch questions from database
            const result = await pool.query(
                'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, category FROM questions ORDER BY RANDOM() LIMIT 10'
            );
            
            if (result.rows.length === 0) {
                socket.emit('gameError', 'No questions available.');
                return;
            }

            room.questions = result.rows;
            room.questionIndex = 0;
            room.gameState = 'question';
            room.answers = {};
            room.scores = {};
            room.players.forEach(p => room.scores[p.id] = 0);

            // Start with first question
            room.currentQuestion = room.questions[0];
            room.currentQuestion.questionNumber = 1;
            room.currentQuestion.totalQuestions = room.questions.length;

            io.to(code).emit('gameStarted', {
                question: room.currentQuestion,
                totalQuestions: room.questions.length
            });

            console.log(`Game started in room ${code}`);
        } catch (err) {
            console.error('Error starting game:', err);
            socket.emit('gameError', 'Failed to start game.');
        }
    });

    // Submit answer event
    socket.on('submitAnswer', ({ code, answer }) => {
        const room = rooms[code];
        if (!room || room.gameState !== 'question') {
            return;
        }

        // Check if player already answered
        if (room.answers[socket.id]) {
            return; // Already answered
        }

        // Store answer
        room.answers[socket.id] = answer;
        
        // Check if all players answered
        const allAnswered = room.players.every(p => room.answers[p.id]);
        
        if (allAnswered) {
            // Wait a bit then show results
            setTimeout(() => {
                showResults(code);
            }, 1000);
        }
    });

    // Function to show results
    function showResults(code) {
        const room = rooms[code];
        if (!room || !room.currentQuestion) return;

        const correctAnswer = room.currentQuestion.correct_answer;
        const results = room.players.map(player => {
            const answer = room.answers[player.id];
            const isCorrect = answer === correctAnswer;
            
            if (isCorrect) {
                room.scores[player.id] = (room.scores[player.id] || 0) + 1;
                player.score = room.scores[player.id];
            }

            return {
                playerId: player.id,
                playerName: player.name,
                answer: answer,
                correct: isCorrect,
                score: room.scores[player.id] || 0
            };
        });

        room.gameState = 'results';
        
        io.to(code).emit('showResults', {
            correctAnswer: correctAnswer,
            results: results,
            questionNumber: room.questionIndex + 1,
            totalQuestions: room.questions.length
        });

        // Move to next question after 5 seconds
        setTimeout(() => {
            nextQuestion(code);
        }, 5000);
    }

    // Function to move to next question
    function nextQuestion(code) {
        const room = rooms[code];
        if (!room) return;

        room.questionIndex++;
        
        if (room.questionIndex >= room.questions.length) {
            // Game finished
            endGame(code);
            return;
        }

        room.currentQuestion = room.questions[room.questionIndex];
        room.currentQuestion.questionNumber = room.questionIndex + 1;
        room.currentQuestion.totalQuestions = room.questions.length;
        room.answers = {};
        room.gameState = 'question';

        io.to(code).emit('nextQuestion', {
            question: room.currentQuestion,
            totalQuestions: room.questions.length
        });
    }

    // Function to end game
    function endGame(code) {
        const room = rooms[code];
        if (!room) return;

        room.gameState = 'finished';
        
        // Get final scores
        const finalScores = room.players.map(player => ({
            name: player.name,
            score: room.scores[player.id] || 0
        })).sort((a, b) => b.score - a.score);

        io.to(code).emit('gameFinished', {
            scores: finalScores
        });

        console.log(`Game finished in room ${code}`);
    }
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

// API to get questions (optional, for admin/managing questions)
app.get('/api/questions', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, category, difficulty FROM questions');
        res.json({ ok: true, questions: result.rows });
    } catch (err) {
        console.error('Database error fetching questions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});


