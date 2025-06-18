
-- Create the worker_applications table
CREATE TABLE IF NOT EXISTS public.worker_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  experience TEXT NOT NULL,
  skills TEXT,
  availability JSONB NOT NULL DEFAULT '{}',
  has_vehicle BOOLEAN DEFAULT false,
  has_tools BOOLEAN DEFAULT false,
  background_check_consent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_worker_applications_status ON worker_applications(status);
CREATE INDEX IF NOT EXISTS idx_worker_applications_created_at ON worker_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_worker_applications_email ON worker_applications(email);

-- Enable Row Level Security
ALTER TABLE worker_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker applications
CREATE POLICY "Anyone can insert worker applications" ON worker_applications 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all worker applications" ON worker_applications 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update worker applications" ON worker_applications 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_worker_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER worker_applications_updated_at
  BEFORE UPDATE ON worker_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_applications_updated_at();
