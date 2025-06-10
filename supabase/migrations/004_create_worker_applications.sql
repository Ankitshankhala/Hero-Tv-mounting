
-- Create worker applications table
CREATE TABLE worker_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create indexes
CREATE INDEX idx_worker_applications_status ON worker_applications(status);
CREATE INDEX idx_worker_applications_created_at ON worker_applications(created_at);
CREATE INDEX idx_worker_applications_email ON worker_applications(email);

-- Enable RLS
ALTER TABLE worker_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker applications
CREATE POLICY "Anyone can insert worker applications" ON worker_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all worker applications" ON worker_applications FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
CREATE POLICY "Admins can update worker applications" ON worker_applications FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
