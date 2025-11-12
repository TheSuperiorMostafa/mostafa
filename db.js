// db.js
// Shared PostgreSQL connection pool + tiny helper functions.

const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'game_auth',
  user: process.env.DB_USER || 'game_app_user',
  password: process.env.DB_PASSWORD || 'game_app_password',
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
  process.exit(1);
});

async function testConnection() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}

async function createTestUser() {
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username`,
    ['test_user', 'test_hash_value_123']
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

async function deleteTestUser() {
  await pool.query('DELETE FROM users WHERE username = $1', ['test_user']);
}

module.exports = {
  pool,
  testConnection,
  createTestUser,
  getUserByUsername,
  deleteTestUser,
};
