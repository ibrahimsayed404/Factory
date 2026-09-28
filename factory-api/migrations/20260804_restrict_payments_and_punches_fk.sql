-- Migration: 20260804_restrict_payments_and_punches_fk.sql
-- Description: Add ON DELETE RESTRICT to customer_payments.customer_id, 
--              supplier_payments.supplier_id, and attendance_punch_events.employee_id.

DO $$
BEGIN
    -- 1. customer_payments.customer_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_payments_customer_id_fkey' AND table_name = 'customer_payments'
    ) THEN
        ALTER TABLE customer_payments DROP CONSTRAINT customer_payments_customer_id_fkey;
    END IF;
    ALTER TABLE customer_payments ADD CONSTRAINT customer_payments_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

    -- 2. supplier_payments.supplier_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplier_payments_supplier_id_fkey' AND table_name = 'supplier_payments'
    ) THEN
        ALTER TABLE supplier_payments DROP CONSTRAINT supplier_payments_supplier_id_fkey;
    END IF;
    ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_supplier_id_fkey 
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;

    -- 3. attendance_punch_events.employee_id constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'attendance_punch_events_employee_id_fkey' AND table_name = 'attendance_punch_events'
    ) THEN
        ALTER TABLE attendance_punch_events DROP CONSTRAINT attendance_punch_events_employee_id_fkey;
    END IF;
    ALTER TABLE attendance_punch_events ADD CONSTRAINT attendance_punch_events_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
END $$;
