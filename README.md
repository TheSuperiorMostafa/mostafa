# Capstone Trivia Backend

Online trivia game (mix of Kahoot + Trivial Pursuit).

This repo currently includes:

- `server.js` — WebSocket + HTTP server for private rooms with full game flow
- **PostgreSQL setup** for user accounts and questions:
  - Dockerized Postgres (`docker-compose.yml`)
  - `sql/init.sql` creates:
    - `game_auth` database (via Docker env)
    - `users` table: (`id`, `username`, `password_hash`)
    - `questions` table: (`id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `category`, `difficulty`)
    - `game_app_user` with limited rights
  - `db.js` — shared Node helper for connecting to the DB
  - `verify-db.js` — script to verify read/write on `users` table
- **Game Features Implemented:**
  - ✅ User authentication (register/login)
  - ✅ Room creation and joining
  - ✅ Lobby with player list
  - ✅ Game flow (start game, questions, answers, results)
  - ✅ Scoring system
  - ✅ Question database with 15 sample questions
  - ✅ Real-time multiplayer gameplay via Socket.IO

## Local setup

1. The following are all needed to run this locally - Node.js, project initialization, express, pg, dotenv, socket.io, PostgreSQL, and a .env.

2. Node.js - to check if it's installed, run:
    ```bash
    node -v
    ```
    If not installed, install the latest version from https://nodejs.org
   
3. Project initialization - in the project folder, run the following for managing dependencies:
   ```bash
   npm init -y
   ```
   Creates a package.json file
   
4. Install dependencies - run the following:
   ```bash
   npm install
   ```
   This will install: express, pg, dotenv, socket.io, bcrypt, body-parser, cors
   - Express is for the web servers
   - pg is for PostgreSQL client
   - dotenv is for environment variables
   - socket.io is for real-time WebSocket communication
   - bcrypt is for password hashing
   - body-parser is for parsing request bodies

5. Create a .env file in the root of the project:
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=game_auth
   DB_USER=game_app_user
   DB_PASSWORD=game_app_password
   DB_SSL=false
   PORT=3000
   ```  
   
7. PostgreSQL needs to be installed and a database setup must be done. Install from https://www.postgresql.org/download/
   Create a database with the following:
   ```bash
   CREATE DATABASE game_auth;
   ```
   Then, create a user and password. These will match with your .env:
   ```bash
   CREATE USER game_app_user WITH PASSWORD 'game_app_password';
   GRANT ALL PRIVILEGES ON DATABASE game_auth TO game_app_user;
   ```
   
   Then run the SQL initialization script to create tables and sample questions:
   ```bash
   psql -U game_app_user -d game_auth -f sql/init.sql
   ```
   Or if using Docker:
   ```bash
   docker-compose up -d
   # Then connect and run the SQL file
   ```

8. Run the server with:
   ```bash
   node server.js
   ```
   Now, in any broswer, open:
   ```bash
   http://localhost:3000
   ```
   
