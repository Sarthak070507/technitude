CREATE DATABASE IF NOT EXISTS tech_treasure;
USE tech_treasure;

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(100) NOT NULL,
  session_id VARCHAR(64) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL UNIQUE,
  current_round TINYINT NOT NULL DEFAULT 1,
  status ENUM('registered','round1','round1_complete','round2','round2_complete','round3','completed') NOT NULL DEFAULT 'registered',
  round1_started_at DATETIME(3) NULL,
  round1_completed_at DATETIME(3) NULL,
  round1_duration DECIMAL(10,3) NULL,
  round1_penalty DECIMAL(10,3) NOT NULL DEFAULT 0,
  round2_started_at DATETIME(3) NULL,
  round2_completed_at DATETIME(3) NULL,
  round2_duration DECIMAL(10,3) NULL,
  round3_started_at DATETIME(3) NULL,
  round3_completed_at DATETIME(3) NULL,
  round3_duration DECIMAL(10,3) NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS round1_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  logo_no INT NOT NULL,
  answer VARCHAR(255) NOT NULL DEFAULT '',
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
  penalty_seconds DECIMAL(10,3) NOT NULL DEFAULT 0,
  answered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX(team_id, logo_no)
);

CREATE TABLE IF NOT EXISTS final_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  last_login_at DATETIME(3) NULL
);
