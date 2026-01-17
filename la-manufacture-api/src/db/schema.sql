-- La Manufacture OS - Database Schema

-- Users table (Clerk authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- Legacy, nullable for Clerk users
  clerk_id VARCHAR(255) UNIQUE, -- Clerk user ID
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Add clerk_id column if not exists (for existing databases)
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;
-- Migration: Make password_hash nullable (Clerk handles auth)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- Migration: Add role column for user type (manager, member, admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'manager' CHECK (role IN ('manager', 'member', 'admin'));

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

-- Migration: Add columns for invited members (can be linked to actual user accounts)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invited_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'manager'));

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

-- Migration: Add status and time tracking to team_tasks
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'blocked'));
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0; -- minutes

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

-- Projects (projets avec taches et documents)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- le manager
  name TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL, -- DEPRECATED: utiliser project_members
  deadline DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project members (assignation multiple de membres aux projets)
CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_member_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, team_member_id)
);

-- Team invitations (invitations par email pour nouveaux membres)
CREATE TABLE IF NOT EXISTS team_invitations (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL, -- Secure UUID v4 token
  team_member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, -- Token expires after 7 days
  accepted_at TIMESTAMP,
  metadata JSONB, -- Additional info like invited user name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project time logs (temps passe sur les projets par les membres)
CREATE TABLE IF NOT EXISTS project_time_logs (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Member who logged time
  team_member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL, -- Link to team member profile
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  description TEXT,
  date DATE NOT NULL, -- Date the work was done
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task time logs (temps passe sur les taches par les membres)
CREATE TABLE IF NOT EXISTS task_time_logs (
  id SERIAL PRIMARY KEY,
  team_task_id INTEGER REFERENCES team_tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_member_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  description TEXT,
  date DATE NOT NULL, -- Date the work was done
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajouter project_id aux tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Ajouter project_id aux team_files
ALTER TABLE team_files ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

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
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON tasks(user_id, done);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_inbox_user ON email_inbox(user_id, processed);
CREATE INDEX IF NOT EXISTS idx_task_sharing_user ON task_sharing(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_task_sharing_task ON task_sharing(task_id);
CREATE INDEX IF NOT EXISTS idx_task_sharing_target ON task_sharing(shared_with_user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_member ON team_tasks(team_member_id, date);
CREATE INDEX IF NOT EXISTS idx_team_tasks_user ON team_tasks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_team_tasks_user_only ON team_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_team_files_user ON team_files(user_id);
CREATE INDEX IF NOT EXISTS idx_team_files_member ON team_files(team_member_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_event ON tasks(user_id, is_event) WHERE is_event = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id) WHERE clerk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_user_only ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_files_project ON team_files(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_invited_user ON team_members(invited_user_id) WHERE invited_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_invitations_manager ON team_invitations(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON team_invitations(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_project_time_logs_project ON project_time_logs(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_project_time_logs_user ON project_time_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_project_time_logs_member ON project_time_logs(team_member_id) WHERE team_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task ON task_time_logs(team_task_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_user ON task_time_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_member ON task_time_logs(team_member_id) WHERE team_member_id IS NOT NULL;

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

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON team_invitations;

CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON team_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECOND BRAIN NOTES SYSTEM
-- =====================================================

-- Notes table (système Second Brain)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  content_search TSVECTOR, -- Full-Text Search vector
  color VARCHAR(20) DEFAULT NULL, -- Couleur pour catégorisation visuelle (blue, green, yellow, orange, red, purple)
  is_pinned BOOLEAN DEFAULT FALSE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Relation optionnelle
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- Relation optionnelle
  archived_at TIMESTAMP, -- Soft-delete
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags définis par utilisateur
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'gray',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name) -- Évite tags dupliqués
);

-- Junction table many-to-many (notes ↔ tags)
CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (note_id, tag_id)
);

-- Partage notes avec équipe
CREATE TABLE IF NOT EXISTS note_shares (
  id SERIAL PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(note_id, shared_with_user_id)
);

-- Tracking décisions IA pour amélioration continue
CREATE TABLE IF NOT EXISTS ai_inbox_decisions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  ai_response JSONB NOT NULL,           -- Réponse brute de Claude
  items_created JSONB NOT NULL,          -- Items effectivement créés en BDD
  user_feedback VARCHAR(50),             -- 'correct', 'incorrect', 'partial'
  user_corrections JSONB,                -- Corrections manuelles utilisateur
  confidence_avg FLOAT,                  -- Moyenne des confidences
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES - Second Brain Notes
-- =====================================================

-- Performance requêtes utilisateur (notes)
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON notes(user_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id, is_pinned) WHERE is_pinned = TRUE;

-- Relations optionnelles
CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(task_id) WHERE task_id IS NOT NULL;

-- Full-Text Search (CRITIQUE pour performance)
CREATE INDEX IF NOT EXISTS idx_notes_search ON notes USING GiST(content_search);

-- Tags
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);

-- Partage
CREATE INDEX IF NOT EXISTS idx_note_shares_note ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_user ON note_shares(shared_with_user_id);

-- AI Decisions (amélioration continue)
CREATE INDEX IF NOT EXISTS idx_ai_decisions_user ON ai_inbox_decisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_feedback ON ai_inbox_decisions(user_feedback) WHERE user_feedback IS NOT NULL;

-- =====================================================
-- TRIGGERS FTS - Auto-update content_search
-- =====================================================

-- Fonction trigger pour Full-Text Search (configuration française)
CREATE OR REPLACE FUNCTION notes_search_trigger() RETURNS TRIGGER AS $$
BEGIN
  -- Pondération: titre (A) prioritaire, contenu (B) secondaire
  -- Configuration 'french' pour tokenization française (accents, stemming)
  NEW.content_search :=
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger FTS sur INSERT/UPDATE
DROP TRIGGER IF EXISTS notes_search_update ON notes;
CREATE TRIGGER notes_search_update
  BEFORE INSERT OR UPDATE OF title, content ON notes
  FOR EACH ROW EXECUTE FUNCTION notes_search_trigger();

-- Trigger updated_at pour notes
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
