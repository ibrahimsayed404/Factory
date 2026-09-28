-- Migration: 20260804_enforce_employee_restrict_fk.sql
-- Description: Re-enforce ON DELETE RESTRICT on payroll.employee_id, attendance.employee_id,
--              hr_leave_requests.employee_id, hr_transactions.employee_id, and hr_loans.employee_id.

DO $$
BEGIN
    -- 1. payroll table foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payroll_employee_id_fkey' AND table_name = 'payroll'
    ) THEN
        ALTER TABLE payroll DROP CONSTRAINT payroll_employee_id_fkey;
    END IF;
    ALTER TABLE payroll ADD CONSTRAINT payroll_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

    -- 2. attendance table foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'attendance_employee_id_fkey' AND table_name = 'attendance'
    ) THEN
        ALTER TABLE attendance DROP CONSTRAINT attendance_employee_id_fkey;
    END IF;
    ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

    -- 3. hr_leave_requests table foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_leave_requests_employee_id_fkey' AND table_name = 'hr_leave_requests'
    ) THEN
        ALTER TABLE hr_leave_requests DROP CONSTRAINT hr_leave_requests_employee_id_fkey;
    END IF;
    ALTER TABLE hr_leave_requests ADD CONSTRAINT hr_leave_requests_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

    -- 4. hr_transactions table foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_transactions_employee_id_fkey' AND table_name = 'hr_transactions'
    ) THEN
        ALTER TABLE hr_transactions DROP CONSTRAINT hr_transactions_employee_id_fkey;
    END IF;
    ALTER TABLE hr_transactions ADD CONSTRAINT hr_transactions_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

    -- 5. hr_loans table foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'hr_loans_employee_id_fkey' AND table_name = 'hr_loans'
    ) THEN
        ALTER TABLE hr_loans DROP CONSTRAINT hr_loans_employee_id_fkey;
    END IF;
    ALTER TABLE hr_loans ADD CONSTRAINT hr_loans_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
END $$;
