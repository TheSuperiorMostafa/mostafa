# Additional Project Documentation

## Enhanced Relationships/Design Structure

The server module (server.js) operates with a layered architecture:
- **Database Layer**: db.js provides connection pooling and query execution for PostgreSQL, handling user authentication and data persistence
- **HTTP API Layer**: Express.js endpoints handle stateless operations (login, registration, room creation)
- **WebSocket Layer**: Socket.IO manages persistent connections for real-time game synchronization
- **In-Memory Game State**: Room data, player information, and game progress stored in server memory for fast access
- **Frontend Layer**: index.html uses Socket.IO client library to maintain bidirectional communication with the server

The database schema (init.sql) defines the foundational data structures, while db.js provides the abstraction layer. server.js coordinates between the database (for user accounts) and in-memory state (for active games), creating a hybrid persistence model optimized for both user data and real-time gameplay.

The frontend (index.html) relies on both HTTP endpoints for initial setup and WebSocket connections for all interactive features. This dual-channel approach allows for efficient authentication while maintaining low-latency game interactions.

## Real-Time Architecture

The application uses a dual communication model combining HTTP REST endpoints and WebSocket connections via Socket.IO. The HTTP endpoints (`/api/login`, `/api/register`, `/api/create-room`, `/api/join-room`) handle initial authentication and room creation, while Socket.IO manages all real-time game interactions. This separation allows for stateless authentication while maintaining persistent connections for game state synchronization.

The WebSocket architecture follows an event-driven pattern where the server emits events to specific rooms using `io.to(roomCode).emit()`, ensuring all players in a room receive synchronized updates. Key events include:
- `joinRoom` / `joinSuccess` - Room joining and player list updates
- `setName` / `setNameSuccess` - Player name selection
- `startGame` / `gameStarted` - Game initialization
- `submitAnswer` / `answerSubmitted` - Answer handling with immediate feedback
- `nextQuestion` - Question progression
- `gameEnded` - Results and leaderboard display
- `updatePlayers` - Real-time player list synchronization

This architecture ensures that all players see the same game state simultaneously, with updates broadcast instantly when any player performs an action.

## Game State Management

The application implements a finite state machine with three primary states:
1. **Lobby State** - Players can join, set names, and wait for the host to start
2. **Playing State** - Active game with questions, answers, and scoring
3. **Results State** - Final leaderboard display with option to return to lobby

State transitions are controlled server-side to prevent race conditions. The server validates state before allowing actions (e.g., preventing room joins during active games, blocking answer submissions outside playing state). Each room maintains its own state independently, allowing multiple concurrent games.

## Scoring Algorithm

The scoring system rewards both accuracy and speed. Each question has a maximum value of 1000 points:
- **Base Score (500 points)**: Awarded for correct answers only
- **Time Bonus (0-500 points)**: Calculated based on response speed
  - Formula: `timeBonus = max(0, floor((30000 - timeElapsed) / 30000 * 500))`
  - Faster answers receive higher bonuses
  - Maximum time window: 30 seconds per question

This dual-factor scoring encourages quick thinking while maintaining accuracy, creating competitive gameplay dynamics.

## Room and Player Management

Rooms are managed in-memory on the server, with each room containing:
- Player list with socket IDs, names, ready status, scores, and host designation
- Current game state (lobby/playing/results)
- Question set (5 randomly selected from 50 available questions)
- Answer tracking for current question
- Host ID for game control

The first player to join a room becomes the host, with automatic reassignment if the host disconnects. Host privileges include starting games and returning to lobby after results. Rooms support up to 8 players and are automatically cleaned up when empty.

## Question System

The trivia game includes 50 questions across multiple categories:
- Geography (8 questions)
- Science (7 questions)
- History (5 questions)
- Literature (3 questions)
- Technology (4 questions)
- General Knowledge (23 questions)

Each game randomly selects 5 questions from this pool, ensuring variety across game sessions. Questions are shuffled server-side before distribution to prevent predictable patterns.

## Frontend-Backend Communication Patterns

The frontend uses a reactive event listener pattern, where UI updates are triggered by WebSocket events rather than polling. This creates a responsive user experience where:
- Player list updates appear instantly when anyone joins/leaves
- Game state changes are immediately reflected across all clients
- Answer submissions provide immediate feedback
- Score updates are synchronized in real-time

The frontend maintains minimal local state (current room code, player name, score) and relies on server broadcasts for authoritative game state, ensuring consistency across all clients.

## Future Improvements

Potential enhancements for future iterations:
- Persistent game history and statistics stored in database
- Question categories that players can select
- Custom question sets or user-submitted questions
- Timer display showing remaining time per question
- Spectator mode for watching active games
- Player avatars or customization options
- Sound effects and animations for better UX
- Mobile-responsive design improvements
- Reconnection handling for dropped connections
- Question difficulty levels
- Power-ups or special game modes

## Known Limitations

Current limitations of the system:
- Rooms are in-memory only (lost on server restart)
- No persistent game history or statistics
- Limited to 8 players per room
- No question timer visible to players
- Single question difficulty level
- No support for custom questions
- No reconnection handling for network interruptions

