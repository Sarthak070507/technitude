CREATE DATABASE IF NOT EXISTS hack_the_hunt;
USE hack_the_hunt;

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL UNIQUE,
  current_round INT DEFAULT 1,
  status VARCHAR(40) DEFAULT 'registered',
  round1_started_at DATETIME(3) NULL,
  round1_completed_at DATETIME(3) NULL,
  round1_duration DECIMAL(10,3) DEFAULT 0,
  round1_penalty INT DEFAULT 0,
  round1_skips INT DEFAULT 0,
  round2_started_at DATETIME(3) NULL,
  round2_completed_at DATETIME(3) NULL,
  round2_duration DECIMAL(10,3) DEFAULT 0,
  round3_started_at DATETIME(3) NULL,
  round3_completed_at DATETIME(3) NULL,
  round3_duration DECIMAL(10,3) DEFAULT 0,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS round1_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  logo_no INT NOT NULL,
  answer VARCHAR(255) DEFAULT '',
  attempt_no INT DEFAULT 1,
  is_correct TINYINT(1) DEFAULT 0,
  is_skipped TINYINT(1) DEFAULT 0,
  penalty_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS final_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  question TEXT NOT NULL,
  answer VARCHAR(500) NOT NULL,
  is_correct TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);