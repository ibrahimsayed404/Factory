-- Migration: 20260804_audit_before_delete_triggers.sql
-- Description: Create BEFORE DELETE triggers on employees, payroll, and attendance 
--              to automatically snapshot old rows as JSONB into audit_logs before deletion.

CREATE OR REPLACE FUNCTION log_before_delete_to_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_name,
    entity_id,
    details,
    created_at
  ) VALUES (
    NULL,                                      -- system/SQL level deletion
    'DIRECT_SQL_DELETE',                       -- action name
    TG_TABLE_NAME,                             -- entity_name ('employees', 'payroll', 'attendance')
    OLD.id::text,                              -- entity_id
    to_jsonb(OLD),                             -- full old row snapshot as JSONB
    NOW()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for employees table
DROP TRIGGER IF EXISTS trg_audit_before_delete_employees ON employees;
CREATE TRIGGER trg_audit_before_delete_employees
BEFORE DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION log_before_delete_to_audit_logs();

-- Trigger for payroll table
DROP TRIGGER IF EXISTS trg_audit_before_delete_payroll ON payroll;
CREATE TRIGGER trg_audit_before_delete_payroll
BEFORE DELETE ON payroll
FOR EACH ROW
EXECUTE FUNCTION log_before_delete_to_audit_logs();

-- Trigger for attendance table
DROP TRIGGER IF EXISTS trg_audit_before_delete_attendance ON attendance;
CREATE TRIGGER trg_audit_before_delete_attendance
BEFORE DELETE ON attendance
FOR EACH ROW
EXECUTE FUNCTION log_before_delete_to_audit_logs();
