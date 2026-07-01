CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
