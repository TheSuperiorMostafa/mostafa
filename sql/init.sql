-- Create users table for login / scores extension
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- Create questions table for trivia game
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    category VARCHAR(50),
    difficulty VARCHAR(20) DEFAULT 'medium'
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

-- Grant permissions on questions table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE questions TO game_app_user;

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
    
    SELECT pg_get_serial_sequence('questions', 'id') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE format('GRANT SELECT, UPDATE ON SEQUENCE %I TO game_app_user;', seq_name);
    END IF;
END;
$$;

-- Insert sample questions
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_answer, category, difficulty) VALUES
('What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'C', 'Geography', 'easy'),
('Who wrote "Romeo and Juliet"?', 'Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain', 'B', 'Literature', 'easy'),
('What is the largest planet in our solar system?', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'C', 'Science', 'medium'),
('In which year did World War II end?', '1943', '1944', '1945', '1946', 'C', 'History', 'medium'),
('What is the chemical symbol for gold?', 'Go', 'Gd', 'Au', 'Ag', 'C', 'Science', 'medium'),
('Which ocean is the largest?', 'Atlantic', 'Indian', 'Arctic', 'Pacific', 'D', 'Geography', 'easy'),
('Who painted the Mona Lisa?', 'Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Michelangelo', 'C', 'Art', 'medium'),
('What is the speed of light in vacuum (approximately)?', '300,000 km/s', '150,000 km/s', '450,000 km/s', '600,000 km/s', 'A', 'Science', 'hard'),
('Which country is home to the kangaroo?', 'New Zealand', 'Australia', 'South Africa', 'Brazil', 'B', 'Geography', 'easy'),
('What is the smallest prime number?', '0', '1', '2', '3', 'C', 'Math', 'easy'),
('Who was the first person to walk on the moon?', 'Buzz Aldrin', 'Neil Armstrong', 'Michael Collins', 'John Glenn', 'B', 'History', 'medium'),
('What is the main ingredient in guacamole?', 'Tomato', 'Avocado', 'Onion', 'Pepper', 'B', 'Food', 'easy'),
('In which sport would you perform a slam dunk?', 'Football', 'Basketball', 'Tennis', 'Soccer', 'B', 'Sports', 'easy'),
('What is the hardest natural substance on Earth?', 'Gold', 'Iron', 'Diamond', 'Platinum', 'C', 'Science', 'medium'),
('Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'B', 'Science', 'easy')
ON CONFLICT DO NOTHING;
