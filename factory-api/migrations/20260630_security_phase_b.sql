-- Add IP address and user-agent columns to audit_logs for forensic analysis.
-- SECURITY: OWASP compliance — audit logs must capture request origin information.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add account lockout columns to users table.
-- SECURITY: Prevents brute-force attacks by locking accounts after repeated failed logins.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
