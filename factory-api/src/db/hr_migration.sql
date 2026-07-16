-- ============================================================
-- HR MODULE EXTENSION
-- ============================================================

CREATE TABLE IF NOT EXISTS hr_positions (
  id SERIAL PRIMARY KEY,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  base_salary NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_shifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  weekend_days VARCHAR(20) DEFAULT '5',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Modify employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_id INT REFERENCES hr_positions(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES hr_shifts(id) ON DELETE SET NULL;

-- Migrate existing shift data to the new table if needed (not strictly required if we just reset them, but let's insert default shifts)
INSERT INTO hr_shifts (name, start_time, end_time, weekend_days) VALUES
('Morning Shift', '09:00:00', '17:00:00', '0,6'),
('Night Shift', '22:00:00', '06:00:00', '0,6')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL, -- 'vacation', 'sick', 'unpaid', 'maternity'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_transactions (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'bonus', 'penalty', 'overtime'
  amount NUMERIC(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_loans (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  principal_amount NUMERIC(10,2) NOT NULL,
  remaining_amount NUMERIC(10,2) NOT NULL,
  monthly_installment NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'active', -- 'active', 'paid_off'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_salary_history (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_salary NUMERIC(10,2),
  new_salary NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(100),
  file_path VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id INT REFERENCES employees(id) ON DELETE SET NULL,
  review_date DATE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_transactions_employee ON hr_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_loans_employee ON hr_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_salary_history_employee ON hr_salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_employee ON hr_performance_reviews(employee_id);
