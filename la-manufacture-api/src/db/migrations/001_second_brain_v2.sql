-- ============================================================================
-- MIGRATION: Second Brain V2 - Intelligence prédictive et mémoire contextuelle
-- ============================================================================

-- ============================================================================
-- TABLE: user_profiles - Profil utilisateur adaptatif (Section 15)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- Identité professionnelle
  profession VARCHAR(100), -- développeur, commercial, artisan, manager, créatif
  domain VARCHAR(100), -- IT, BTP, commerce, santé, juridique, finance
  role_level VARCHAR(50), -- exécutant, responsable, dirigeant

  -- Style de communication
  formality VARCHAR(20) DEFAULT 'neutre', -- formel, neutre, informel
  verbosity VARCHAR(20) DEFAULT 'standard', -- concis, standard, détaillé
  tone VARCHAR(20) DEFAULT 'direct', -- direct, diplomatique, enthousiaste

  -- Préférences de travail (JSON)
  work_preferences JSONB DEFAULT '{
    "default_task_duration": 30,
    "peak_hours": ["09:00-12:00", "14:00-17:00"],
    "meeting_buffer": 15,
    "default_deadline_days": 3
  }',

  -- Vocabulaire personnalisé (JSON)
  vocabulary JSONB DEFAULT '{
    "abbreviations": {},
    "custom_terms": {},
    "people_aliases": {}
  }',

  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================================================
-- TABLE: learned_entities - Entités apprises (Section 17)
-- ============================================================================

CREATE TABLE IF NOT EXISTS learned_entities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  entity_type VARCHAR(50) NOT NULL, -- person, company, location, alias
  entity_name VARCHAR(255) NOT NULL,

  -- Métadonnées de l'entité (JSON)
  entity_data JSONB DEFAULT '{}',
  -- Ex pour person: {"full_name": "Marie Dupont", "role": "collegue", "department": "Marketing"}
  -- Ex pour company: {"type": "client", "importance": "VIP", "contacts": ["Jean"]}
  -- Ex pour location: {"address": "12 rue...", "type": "bureau"}
  -- Ex pour alias: {"resolved_to": "Mathieu", "context": "prénom court"}

  -- Stats d'utilisation
  frequency INTEGER DEFAULT 1, -- nombre de mentions
  last_interaction TIMESTAMP DEFAULT NOW(),

  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, entity_type, entity_name)
);

-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_learned_entities_user ON learned_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_entities_type ON learned_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_learned_entities_name ON learned_entities(entity_name);

-- ============================================================================
-- TABLE: user_patterns - Patterns récurrents détectés (Section 14)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  pattern_type VARCHAR(50) NOT NULL, -- weekly, monthly, biweekly, conditional, chain
  trigger_text TEXT, -- "tous les lundis", "après chaque réunion client"
  action_text TEXT, -- "Revue équipe", "Envoyer compte-rendu"

  -- Règle de récurrence (format iCal RRULE)
  recurrence_rule TEXT, -- "FREQ=WEEKLY;BYDAY=MO"

  -- Configuration
  typical_time TIME,
  typical_duration_minutes INTEGER,
  auto_create BOOLEAN DEFAULT FALSE,

  -- Stats
  confidence DECIMAL(3,2) DEFAULT 0.80,
  occurrence_count INTEGER DEFAULT 1,
  last_triggered_at TIMESTAMP,

  -- Métadonnées
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patterns_type ON user_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_user_patterns_active ON user_patterns(is_active);

-- ============================================================================
-- TABLE: task_chains - Chaînes de tâches (Section 14)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_chains (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  chain_name VARCHAR(255) NOT NULL,
  trigger_condition TEXT, -- "any_event_with_tag_client", "task_type_devis"

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  auto_create_next BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_chain_items (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER REFERENCES task_chains(id) ON DELETE CASCADE,

  position INTEGER NOT NULL,
  task_template TEXT NOT NULL, -- "Envoyer compte-rendu {event_name}"
  delay_rule VARCHAR(50), -- same_day, J+1, J+7, after_completion
  trigger_condition VARCHAR(50), -- after_completion, if_positive, if_negative
  auto_create BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_chains_user ON task_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_task_chain_items_chain ON task_chain_items(chain_id);

-- ============================================================================
-- TABLE: ai_corrections - Historique des corrections utilisateur (Section 17)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_corrections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- Contexte de l'erreur
  original_input TEXT,
  ai_output JSONB, -- item généré par l'IA

  -- Correction appliquée
  corrected_field VARCHAR(100), -- urgent, type, owner, date, etc.
  original_value TEXT,
  corrected_value TEXT,
  user_comment TEXT,

  -- Règle apprise
  learned_rule JSONB, -- {"pattern": "...", "action": "...", "confidence_adjustment": -0.15}

  -- Stats
  applied_count INTEGER DEFAULT 0, -- nombre de fois où cette correction a été utilisée
  last_applied_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrections_user ON ai_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_field ON ai_corrections(corrected_field);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_recent ON ai_corrections(created_at DESC);

-- ============================================================================
-- TABLE: smart_reminders - Rappels intelligents générés (Section 14)
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  source_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,

  reminder_text TEXT NOT NULL,
  trigger_date DATE NOT NULL,
  trigger_time TIME,

  reminder_type VARCHAR(20) DEFAULT 'notification', -- notification, email, task
  reason TEXT, -- "Rappel 24h avant RDV médical"

  -- Status
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  is_dismissed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_reminders_user ON smart_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_date ON smart_reminders(trigger_date);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_pending ON smart_reminders(is_sent, trigger_date);

-- ============================================================================
-- TABLE: proactive_suggestions - Suggestions proactives (Section 16)
-- ============================================================================

CREATE TABLE IF NOT EXISTS proactive_suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  source_item_id INTEGER, -- task/event qui a déclenché la suggestion
  source_item_type VARCHAR(20), -- task, event

  suggestion_type VARCHAR(50) NOT NULL, -- prep_task, followup, implicit_action, etc.
  suggested_task TEXT NOT NULL,
  suggested_date DATE,

  priority_score DECIMAL(3,2),
  reason TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, dismissed, auto_created
  accepted_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  created_task_id INTEGER REFERENCES tasks(id),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_user ON proactive_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_status ON proactive_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_proactive_suggestions_date ON proactive_suggestions(suggested_date);

-- ============================================================================
-- TABLE: ai_inbox_decisions - Enrichie pour tracking V2
-- ============================================================================

-- Ajouter colonnes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_inbox_decisions' AND column_name = 'patterns_detected') THEN
    ALTER TABLE ai_inbox_decisions ADD COLUMN patterns_detected JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_inbox_decisions' AND column_name = 'suggestions_generated') THEN
    ALTER TABLE ai_inbox_decisions ADD COLUMN suggestions_generated JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_inbox_decisions' AND column_name = 'memory_context_used') THEN
    ALTER TABLE ai_inbox_decisions ADD COLUMN memory_context_used JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_inbox_decisions' AND column_name = 'learning_signals') THEN
    ALTER TABLE ai_inbox_decisions ADD COLUMN learning_signals JSONB;
  END IF;
END $$;

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour récupérer le profil utilisateur complet
CREATE OR REPLACE FUNCTION get_user_memory_context(p_user_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_profile', (
      SELECT row_to_json(up.*) FROM user_profiles up WHERE up.user_id = p_user_id
    ),
    'learned_entities', (
      SELECT jsonb_object_agg(
        le.entity_type || ':' || le.entity_name,
        le.entity_data
      )
      FROM learned_entities le
      WHERE le.user_id = p_user_id
    ),
    'corrections_history', (
      SELECT jsonb_agg(row_to_json(ac.*) ORDER BY ac.created_at DESC)
      FROM (
        SELECT corrected_field, original_value, corrected_value, learned_rule, created_at
        FROM ai_corrections
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 10
      ) ac
    ),
    'patterns', (
      SELECT jsonb_agg(row_to_json(up.*))
      FROM user_patterns up
      WHERE up.user_id = p_user_id AND up.is_active = TRUE
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour une entité apprise
CREATE OR REPLACE FUNCTION upsert_learned_entity(
  p_user_id INTEGER,
  p_entity_type VARCHAR,
  p_entity_name VARCHAR,
  p_entity_data JSONB
)
RETURNS INTEGER AS $$
DECLARE
  entity_id INTEGER;
BEGIN
  INSERT INTO learned_entities (user_id, entity_type, entity_name, entity_data, frequency)
  VALUES (p_user_id, p_entity_type, p_entity_name, p_entity_data, 1)
  ON CONFLICT (user_id, entity_type, entity_name)
  DO UPDATE SET
    entity_data = learned_entities.entity_data || p_entity_data,
    frequency = learned_entities.frequency + 1,
    last_interaction = NOW(),
    updated_at = NOW()
  RETURNING id INTO entity_id;

  RETURN entity_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux nouvelles tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_user_profiles_updated_at') THEN
    CREATE TRIGGER trigger_user_profiles_updated_at
      BEFORE UPDATE ON user_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_learned_entities_updated_at') THEN
    CREATE TRIGGER trigger_learned_entities_updated_at
      BEFORE UPDATE ON learned_entities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_user_patterns_updated_at') THEN
    CREATE TRIGGER trigger_user_patterns_updated_at
      BEFORE UPDATE ON user_patterns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Profil utilisateur adaptatif - Section 15 Second Brain V2';
COMMENT ON TABLE learned_entities IS 'Entités apprises (personnes, entreprises, lieux) - Section 17';
COMMENT ON TABLE user_patterns IS 'Patterns récurrents détectés - Section 14';
COMMENT ON TABLE task_chains IS 'Chaînes de tâches automatiques - Section 14';
COMMENT ON TABLE ai_corrections IS 'Historique des corrections pour apprentissage - Section 17';
COMMENT ON TABLE smart_reminders IS 'Rappels intelligents générés - Section 14';
COMMENT ON TABLE proactive_suggestions IS 'Suggestions proactives - Section 16';
