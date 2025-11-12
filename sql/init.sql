-- Create users table for login / scores extension
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- App user used by the Node backend (not the admin account)
DO
$$
BEGIN
   IF NOT EXISTS (
       SELECT FROM pg_catalog.pg_roles WHERE rolname = 'game_app_user'
   ) THEN
      CREATE USER game_app_user WITH PASSWORD 'game_app_password';
   END IF;
END
$$;

-- Permissions for app user
GRANT CONNECT ON DATABASE game_auth TO game_app_user;
GRANT USAGE ON SCHEMA public TO game_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO game_app_user;

-- Ensure SERIAL sequence privileges
DO
$$
DECLARE
    seq_name text;
BEGIN
    SELECT pg_get_serial_sequence('users', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE format('GRANT SELECT, UPDATE ON SEQUENCE %I TO game_app_user;', seq_name);
    END IF;
END;
$$;
