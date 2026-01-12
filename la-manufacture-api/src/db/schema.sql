-- La Manufacture OS - Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table (version cible avec statuts + délégation)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  original_date DATE,
  owner VARCHAR(255) NOT NULL,
  assignee VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'en_attente', 'delegue', 'bloque', 'termine')),
  urgent BOOLEAN DEFAULT FALSE,
  done BOOLEAN DEFAULT FALSE,
  time_spent INTEGER DEFAULT 0, -- en minutes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (per user)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owners TEXT[], -- Array of owner names
  carry_over_mode VARCHAR(50) DEFAULT 'move' CHECK (carry_over_mode IN ('move', 'duplicate', 'manual')),
  ai_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log (pour historique et analytics)
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'completed', 'updated', 'deleted', 'carried_over'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI interactions (pour tracking usage Claude API)
CREATE TABLE IF NOT EXISTS ai_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'focus_mode', 'coach', 'parser', 'prioritize'
  prompt TEXT,
  response TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email inbox (pour email forwarding)
CREATE TABLE IF NOT EXISTS email_inbox (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_email VARCHAR(255),
  subject TEXT,
  body TEXT,
  processed BOOLEAN DEFAULT FALSE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task sharing (partage de taches entre utilisateurs)
CREATE TABLE IF NOT EXISTS task_sharing (
  id SERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, shared_with_user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members (employes sans compte, lies a un manager)
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- le manager
  name VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#3b82f6', -- couleur hex pour avatar
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team tasks (taches assignees aux membres d'equipe)
CREATE TABLE IF NOT EXISTS team_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- le manager
  team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  date DATE NOT NULL,
  urgent BOOLEAN DEFAULT FALSE,
  done BOOLEAN DEFAULT FALSE,
  done_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team files (fichiers partages - globaux ou par membre)
CREATE TABLE IF NOT EXISTS team_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- le manager
  team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE, -- NULL = global
  filename VARCHAR(255) NOT NULL, -- nom stocke sur le serveur
  original_name VARCHAR(255) NOT NULL, -- nom original du fichier
  mime_type VARCHAR(100),
  size INTEGER, -- taille en bytes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Google Calendar tokens (OAuth2 pour sync calendrier)
CREATE TABLE IF NOT EXISTS google_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  calendar_id VARCHAR(255) DEFAULT 'primary',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout colonnes RDV/Event a tasks (pour sync Google Calendar)
-- is_event: true si c'est un RDV (detecte par AI), false si tache normale
-- start_time/end_time: heure du RDV
-- location: lieu du RDV (optionnel)
-- google_event_id: ID de l'evenement dans Google Calendar
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON tasks(user_id, done);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_user ON email_inbox(user_id, processed);
CREATE INDEX IF NOT EXISTS idx_task_sharing_user ON task_sharing(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_task_sharing_task ON task_sharing(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_member ON team_tasks(team_member_id, date);
CREATE INDEX IF NOT EXISTS idx_team_tasks_user ON team_tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_team_files_user ON team_files(user_id);
CREATE INDEX IF NOT EXISTS idx_team_files_member ON team_files(team_member_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_event ON tasks(user_id, is_event) WHERE is_event = TRUE;

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers first (idempotent)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
DROP TRIGGER IF EXISTS update_team_tasks_updated_at ON team_tasks;

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_tasks_updated_at BEFORE UPDATE ON team_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_tokens_updated_at ON google_tokens;

CREATE TRIGGER update_google_tokens_updated_at BEFORE UPDATE ON google_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
