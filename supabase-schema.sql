-- ============================================================
-- NisiClinic CRM — Supabase Database Schema
-- Run this entire script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run
-- ============================================================

-- 1. Enable UUID Extension (optional, we use prefixed IDs like PAT_..., VIS_...)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  patient_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age TEXT,
  gender TEXT,
  date_of_birth TEXT,
  address TEXT,
  medical_notes TEXT,
  allergies TEXT,
  emergency_contact TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Visits Table
CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  complaint TEXT,
  diagnosis TEXT,
  clinical_notes TEXT,
  treatment TEXT,
  medicines JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  balance NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  follow_up_date DATE,
  created_by TEXT DEFAULT 'doctor',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  reason TEXT,
  dentist TEXT DEFAULT 'Dr. Nisi',
  status TEXT DEFAULT 'Confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Medicines Table
CREATE TABLE IF NOT EXISTS medicines (
  medicine_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Tablet',
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  stock_qty INTEGER DEFAULT 0,
  unit_price NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Medicine Stock Logs Table
CREATE TABLE IF NOT EXISTS medicine_stock_logs (
  log_id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL REFERENCES medicines(medicine_id) ON DELETE CASCADE,
  change_qty INTEGER NOT NULL,
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_balance ON visits(balance);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_visit_id ON payments(visit_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_stock_logs_medicine_id ON medicine_stock_logs(medicine_id);

-- ============================================================
-- Auto-Updated At Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_visits_updated_at ON visits;
CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_medicines_updated_at ON medicines;
CREATE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row Level Security (RLS) Policies
-- Allow public anon access with project API key for CRM usage
-- ============================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_stock_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Anon full access on patients" ON patients;
CREATE POLICY "Anon full access on patients" ON patients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access on visits" ON visits;
CREATE POLICY "Anon full access on visits" ON visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access on payments" ON payments;
CREATE POLICY "Anon full access on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access on appointments" ON appointments;
CREATE POLICY "Anon full access on appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access on medicines" ON medicines;
CREATE POLICY "Anon full access on medicines" ON medicines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon full access on medicine_stock_logs" ON medicine_stock_logs;
CREATE POLICY "Anon full access on medicine_stock_logs" ON medicine_stock_logs FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime (Optional)
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
ALTER PUBLICATION supabase_realtime ADD TABLE visits;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE medicines;
