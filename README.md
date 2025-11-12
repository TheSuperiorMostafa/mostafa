# Capstone Trivia Backend

Online trivia game (mix of Kahoot + Trivial Pursuit).

This repo currently includes:

- `server.js` — WebSocket + HTTP server for private rooms (in-memory rooms).
- **PostgreSQL setup** for user accounts:
  - Dockerized Postgres (`docker-compose.yml`)
  - `sql/init.sql` creates:
    - `game_auth` database (via Docker env)
    - `users` table: (`id`, `username`, `password_hash`)
    - `game_app_user` with limited rights
  - `db.js` — shared Node helper for connecting to the DB
  - `verify-db.js` — script to verify read/write on `users` table

## Local setup

1. Install dependencies:

   ```bash
   npm install
