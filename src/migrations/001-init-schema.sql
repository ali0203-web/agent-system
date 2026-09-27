-- Initialize agent system schema for PostgreSQL

-- Agent Results Table
CREATE TABLE IF NOT EXISTS agent_results (
  id SERIAL PRIMARY KEY,
  agent_id UUID NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  data JSONB,
  error TEXT,
  executed_at TIMESTAMP NOT NULL,
  execution_time INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_results_agent_id ON agent_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_results_executed_at ON agent_results(executed_at);

-- Agent Registry Table
CREATE TABLE IF NOT EXISTS agent_registry (
  id SERIAL PRIMARY KEY,
  agent_id UUID UNIQUE NOT NULL,
  agent_name VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'inactive',
  config JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  emitted_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Grant permissions for application user (if needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
