-- Agent Signals Table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  symbol VARCHAR(50),
  signal_type VARCHAR(100),
  confidence FLOAT,
  message TEXT,
  data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_agent_id (agent_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_symbol (symbol)
);

-- Trade Execution Log Table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  entry_price FLOAT,
  exit_price FLOAT,
  position_size FLOAT,
  profit_loss FLOAT,
  status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  INDEX idx_agent_id (agent_id),
  INDEX idx_symbol (symbol),
  INDEX idx_created_at (created_at)
);

-- Agent Performance Metrics Table
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  agent_name VARCHAR(255),
  win_rate FLOAT DEFAULT 0,
  total_trades INT DEFAULT 0,
  profit_loss FLOAT DEFAULT 0,
  avg_holding_time INT DEFAULT 0,
  sharpe_ratio FLOAT DEFAULT 0,
  last_execution TIMESTAMPTZ,
  execution_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_agent_id (agent_id)
);

-- Agent Status Table (Real-time)
CREATE TABLE IF NOT EXISTS agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  agent_name VARCHAR(255),
  status VARCHAR(50),
  last_execution TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  execution_time_ms INT,
  error_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_agent_id (agent_id),
  INDEX idx_status (status)
);

-- Dashboard Events Table (for real-time updates)
CREATE TABLE IF NOT EXISTS dashboard_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100),
  agent_id VARCHAR(255),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_agent_id (agent_id),
  INDEX idx_created_at (created_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_signals_agent_id ON signals(agent_id);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_agent_id ON trades(agent_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_dashboard_events_created_at ON dashboard_events(created_at DESC);

-- Create views for dashboard
CREATE OR REPLACE VIEW signal_stats AS
SELECT 
  agent_id,
  COUNT(*) as signal_count,
  COUNT(CASE WHEN confidence > 0.7 THEN 1 END) as high_confidence_count,
  MAX(timestamp) as last_signal,
  ARRAY_AGG(DISTINCT signal_type) as signal_types
FROM signals
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY agent_id;

CREATE OR REPLACE VIEW agent_summary AS
SELECT 
  m.agent_id,
  m.agent_name,
  m.total_trades,
  m.profit_loss,
  m.win_rate,
  m.sharpe_ratio,
  s.status,
  s.last_execution,
  ss.signal_count,
  ss.high_confidence_count,
  ss.last_signal
FROM agent_metrics m
LEFT JOIN agent_status s ON m.agent_id = s.agent_id
LEFT JOIN signal_stats ss ON m.agent_id = ss.agent_id;

