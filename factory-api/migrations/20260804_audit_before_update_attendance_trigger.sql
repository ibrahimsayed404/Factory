-- Migration: 20260804_audit_before_update_attendance_trigger.sql
-- Description: Create BEFORE UPDATE trigger on attendance table to log old and new row states into audit_logs.

CREATE OR REPLACE FUNCTION log_before_update_attendance_to_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  -- Log old and new state whenever any column on attendance row is updated
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_name,
    entity_id,
    details,
    created_at
  ) VALUES (
    NULL,                                             -- System/Trigger level action
    'ATTENDANCE_MODIFIED',                            -- Action name
    'attendance',                                     -- Entity name
    OLD.id::text,                                     -- Attendance record ID
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW),
      'updated_at', NOW()
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_before_update_attendance ON attendance;
CREATE TRIGGER trg_audit_before_update_attendance
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION log_before_update_attendance_to_audit_logs();
