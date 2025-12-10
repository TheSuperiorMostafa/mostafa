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

// Trivia Questions Database
const questions = [
    // Geography
    {
        question: "What is the capital of France?",
        options: ["London", "Berlin", "Paris", "Madrid"],
        correct: 2
    },
    {
        question: "What is the largest ocean on Earth?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correct: 3
    },
    {
        question: "How many continents are there?",
        options: ["5", "6", "7", "8"],
        correct: 2
    },
    {
        question: "What is the longest river in the world?",
        options: ["Amazon", "Nile", "Mississippi", "Yangtze"],
        correct: 1
    },
    {
        question: "Which country is home to the kangaroo?",
        options: ["New Zealand", "Australia", "South Africa", "Brazil"],
        correct: 1
    },
    {
        question: "What is the smallest country in the world?",
        options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
        correct: 1
    },
    {
        question: "Which mountain is the tallest in the world?",
        options: ["K2", "Mount Everest", "Kilimanjaro", "Mount Fuji"],
        correct: 1
    },
    {
        question: "What is the capital of Japan?",
        options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
        correct: 2
    },
    
    // Science
    {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correct: 1
    },
    {
        question: "What is the speed of light in vacuum (approximately)?",
        options: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "600,000 km/s"],
        correct: 0
    },
    {
        question: "What is the chemical symbol for gold?",
        options: ["Go", "Gd", "Au", "Ag"],
        correct: 2
    },
    {
        question: "What is the most abundant gas in Earth's atmosphere?",
        options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"],
        correct: 2
    },
    {
        question: "How many bones are in an adult human body?",
        options: ["196", "206", "216", "226"],
        correct: 1
    },
    {
        question: "What is the hardest natural substance on Earth?",
        options: ["Gold", "Iron", "Diamond", "Platinum"],
        correct: 2
    },
    {
        question: "Which gas do plants absorb from the atmosphere?",
        options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
        correct: 2
    },
    {
        question: "What is the closest star to Earth?",
        options: ["Proxima Centauri", "The Sun", "Sirius", "Alpha Centauri"],
        correct: 1
    },
    
    // History
    {
        question: "In which year did World War II end?",
        options: ["1943", "1944", "1945", "1946"],
        correct: 2
    },
    {
        question: "Who was the first person to walk on the moon?",
        options: ["Buzz Aldrin", "Neil Armstrong", "Michael Collins", "John Glenn"],
        correct: 1
    },
    {
        question: "In which year did the Berlin Wall fall?",
        options: ["1987", "1989", "1991", "1993"],
        correct: 1
    },
    {
        question: "Which ancient wonder of the world was located in Alexandria?",
        options: ["Hanging Gardens", "Colossus of Rhodes", "Lighthouse", "Great Pyramid"],
        correct: 2
    },
    {
        question: "Who painted the Mona Lisa?",
        options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
        correct: 2
    },
    
    // Literature
    {
        question: "Who wrote 'Romeo and Juliet'?",
        options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
        correct: 1
    },
    {
        question: "In which book would you find the character Atticus Finch?",
        options: ["The Great Gatsby", "To Kill a Mockingbird", "1984", "Catcher in the Rye"],
        correct: 1
    },
    {
        question: "Who wrote '1984'?",
        options: ["George Orwell", "Aldous Huxley", "Ray Bradbury", "J.D. Salinger"],
        correct: 0
    },
    
    // Technology
    {
        question: "Which programming language is known as the 'language of the web'?",
        options: ["Python", "Java", "JavaScript", "C++"],
        correct: 2
    },
    {
        question: "What does CPU stand for?",
        options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Computer Processing Unit"],
        correct: 0
    },
    {
        question: "What year was the first iPhone released?",
        options: ["2005", "2006", "2007", "2008"],
        correct: 2
    },
    {
        question: "What does HTML stand for?",
        options: ["HyperText Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"],
        correct: 0
    },
    
    // General Knowledge
    {
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correct: 1
    },
    {
        question: "How many sides does a hexagon have?",
        options: ["5", "6", "7", "8"],
        correct: 1
    },
    {
        question: "What is the largest mammal in the world?",
        options: ["African Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
        correct: 1
    },
    {
        question: "Which sport is played at Wimbledon?",
        options: ["Golf", "Tennis", "Cricket", "Rugby"],
        correct: 1
    },
    {
        question: "What is the main ingredient in guacamole?",
        options: ["Tomato", "Avocado", "Onion", "Pepper"],
        correct: 1
    },
    {
        question: "How many minutes are in an hour?",
        options: ["50", "60", "70", "100"],
        correct: 1
    },
    {
        question: "What is the capital of Canada?",
        options: ["Toronto", "Vancouver", "Ottawa", "Montreal"],
        correct: 2
    },
    {
        question: "Which planet is closest to the Sun?",
        options: ["Venus", "Earth", "Mercury", "Mars"],
        correct: 2
    },
    {
        question: "What is the square root of 64?",
        options: ["6", "7", "8", "9"],
        correct: 2
    },
    {
        question: "Which animal is known as the 'King of the Jungle'?",
        options: ["Tiger", "Lion", "Leopard", "Cheetah"],
        correct: 1
    },
    {
        question: "What is the chemical formula for water?",
        options: ["H2O", "CO2", "NaCl", "O2"],
        correct: 0
    },
    {
        question: "How many strings does a standard guitar have?",
        options: ["4", "5", "6", "7"],
        correct: 2
    },
    {
        question: "What is the largest planet in our solar system?",
        options: ["Saturn", "Jupiter", "Neptune", "Uranus"],
        correct: 1
    },
    {
        question: "Which country invented pizza?",
        options: ["United States", "France", "Italy", "Greece"],
        correct: 2
    },
    {
        question: "What is the freezing point of water in Celsius?",
        options: ["-10°C", "0°C", "10°C", "32°C"],
        correct: 1
    },
    {
        question: "How many chambers does a human heart have?",
        options: ["2", "3", "4", "5"],
        correct: 2
    },
    {
        question: "What is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correct: 2
    },
    {
        question: "Which element has the chemical symbol 'Fe'?",
        options: ["Fluorine", "Iron", "Francium", "Fermium"],
        correct: 1
    },
    {
        question: "What is the smallest prime number?",
        options: ["0", "1", "2", "3"],
        correct: 2
    },
    {
        question: "Which ocean is between America and Europe?",
        options: ["Pacific", "Indian", "Arctic", "Atlantic"],
        correct: 3
    }
];

// In-memory rooms data
// { roomCode: { 
//     players: [{id, name, ready, score, isHost}], 
//     hostId: socketId,
//     state: 'lobby' | 'playing' | 'results',
//     currentQuestion: number,
//     questionStartTime: timestamp,
//     answers: {socketId: answerIndex}
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
        hostId: null, // Will be set when host joins via socket
        state: 'lobby',
        currentQuestion: -1,
        questionStartTime: null,
        answers: {}
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
    socket.on('joinRoom', ({ code }) => {
        if (!rooms[code]) {
            rooms[code] = { 
                players: [],
                hostId: null,
                state: 'lobby',
                currentQuestion: -1,
                questionStartTime: null,
                answers: {}
            };
        }

        const room = rooms[code];

        // Don't allow joining if game is in progress
        if (room.state === 'playing') {
            socket.emit('joinError', 'Game is already in progress.');
            return;
        }

        // Count only ready players (with names)
        const readyPlayers = room.players.filter(p => p.ready).length;
        if (readyPlayers >= 8) {
            socket.emit('joinError', 'Room is full.')
            return;
        }

        // Avoid duplicates
        if (!room.players.find(p => p.id === socket.id)) {
            // Check if this is the first player (host)
            const isHost = room.players.length === 0;
            if (isHost) {
                room.hostId = socket.id;
            }
            
            // Add as pending player (no name yet)
            room.players.push({ 
                id: socket.id, 
                name: null, 
                ready: false,
                score: 0,
                isHost: isHost
            });
        }

        socket.join(code);

        // Broadcast updated players list to all clients in the room
        io.to(code).emit('updatePlayers', room.players);

        // Confirm join to client with host info
        socket.emit('joinSuccess', { 
            code, 
            players: room.players,
            isHost: room.players.find(p => p.id === socket.id)?.isHost || false,
            state: room.state
        });
    });

    socket.on('setName', ({ code, playerName }) => {
        const room = rooms[code];
        if (!room) {
            socket.emit('setNameError', 'Room not found.');
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('setNameError', 'Player not found in room.');
            return;
        }

        // Set the player's name and mark as ready
        player.name = playerName;
        player.ready = true;

        // Broadcast updated players list to all clients in the room
        io.to(code).emit('updatePlayers', room.players);
        socket.emit('setNameSuccess', { playerName });
    });

    socket.on('startGame', ({ code }) => {
        const room = rooms[code];
        if (!room) {
            socket.emit('startGameError', 'Room not found.');
            return;
        }

        // Check if requester is the host
        if (room.hostId !== socket.id) {
            socket.emit('startGameError', 'Only the host can start the game.');
            return;
        }

        // Check if game is already started
        if (room.state !== 'lobby') {
            socket.emit('startGameError', 'Game already started.');
            return;
        }

        // Validate minimum players and all ready (allow 1 player for testing)
        const readyPlayers = room.players.filter(p => p.ready && p.name);
        if (readyPlayers.length < 1) {
            socket.emit('startGameError', 'Need at least 1 player to start.');
            return;
        }

        // Reset scores and start game
        room.players.forEach(p => {
            p.score = 0;
        });
        room.state = 'playing';
        room.currentQuestion = 0;
        room.answers = {};

        // Shuffle questions and select first 5
        const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, 5);
        room.questions = shuffledQuestions;

        // Start first question
        const question = room.questions[0];
        room.questionStartTime = Date.now();
        room.answers = {};

        // Broadcast game start to all players
        io.to(code).emit('gameStarted', {
            question: question,
            questionNumber: 1,
            totalQuestions: room.questions.length
        });
    });

    socket.on('submitAnswer', ({ code, answerIndex }) => {
        const room = rooms[code];
        if (!room) {
            socket.emit('submitAnswerError', 'Room not found.');
            return;
        }

        if (room.state !== 'playing') {
            socket.emit('submitAnswerError', 'Game is not in progress.');
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('submitAnswerError', 'Player not found.');
            return;
        }

        // Check if already answered
        if (room.answers[socket.id] !== undefined) {
            socket.emit('submitAnswerError', 'You already answered this question.');
            return;
        }

        // Record answer
        room.answers[socket.id] = answerIndex;
        const currentQ = room.questions[room.currentQuestion];
        const isCorrect = answerIndex === currentQ.correct;

        // Calculate score based on time (faster = more points, max 1000 points per question)
        const timeElapsed = Date.now() - room.questionStartTime;
        const maxTime = 30000; // 30 seconds
        const timeBonus = Math.max(0, Math.floor((maxTime - timeElapsed) / maxTime * 500));
        const baseScore = isCorrect ? 500 : 0;
        const points = baseScore + timeBonus;

        if (isCorrect) {
            player.score += points;
        }

        // Confirm answer received
        socket.emit('answerSubmitted', { isCorrect, points, totalScore: player.score });

        // Check if all players answered
        const readyPlayers = room.players.filter(p => p.ready && p.name);
        if (Object.keys(room.answers).length === readyPlayers.length) {
            // All players answered, move to next question after a delay
            setTimeout(() => {
                nextQuestion(room, code);
            }, 3000);
        }
    });

    function nextQuestion(room, code) {
        room.currentQuestion++;
        
        if (room.currentQuestion >= room.questions.length) {
            // Game over, show results
            endGame(room, code);
        } else {
            // Next question
            room.questionStartTime = Date.now();
            room.answers = {};
            const question = room.questions[room.currentQuestion];
            
            io.to(code).emit('nextQuestion', {
                question: question,
                questionNumber: room.currentQuestion + 1,
                totalQuestions: room.questions.length,
                scores: room.players.map(p => ({ name: p.name, score: p.score }))
            });
        }
    }

    function endGame(room, code) {
        room.state = 'results';
        
        // Sort players by score
        const leaderboard = room.players
            .filter(p => p.ready && p.name)
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

        io.to(code).emit('gameEnded', { leaderboard });
    }

    socket.on('returnToLobby', ({ code }) => {
        const room = rooms[code];
        if (!room) {
            return;
        }

        // Only host can return to lobby
        if (room.hostId !== socket.id) {
            return;
        }

        // Reset game state
        room.state = 'lobby';
        room.currentQuestion = -1;
        room.questionStartTime = null;
        room.answers = {};
        room.players.forEach(p => {
            p.score = 0;
        });

        io.to(code).emit('returnedToLobby');
    });

    socket.on('leaveRoom', (code) => {
        const room = rooms[code];
        if (room) {
            const index = room.players.findIndex(p => p.id === socket.id);
            
            if (index !== -1) {
                const wasHost = room.hostId === socket.id;
                room.players.splice(index, 1);
                
                socket.leave(code);

                // If host left and there are still players, assign new host
                if (wasHost && room.players.length > 0) {
                    room.hostId = room.players[0].id;
                    room.players[0].isHost = true;
                }

                io.to(code).emit('updatePlayers', room.players);

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
                const wasHost = room.hostId === socket.id;
                // Remove the player
                room.players.splice(index, 1);

                // If host disconnected and there are still players, assign new host
                if (wasHost && room.players.length > 0) {
                    room.hostId = room.players[0].id;
                    room.players[0].isHost = true;
                }

                // Update all remaining clients in the room
                io.to(code).emit('updatePlayers', room.players);

                // If no players left, delete the room entirely
                if (room.players.length === 0) {
                    delete rooms[code];
                    console.log(`Room ${code} closed (no players remaining)`);
                }

            break; // stop once we've found and removed the player
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


