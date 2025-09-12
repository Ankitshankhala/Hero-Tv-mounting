-- Create tour_completion table to track user tour completion status
CREATE TABLE IF NOT EXISTS public.tour_completion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_type TEXT NOT NULL CHECK (tour_type IN ('admin', 'worker')),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tour_type)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tour_completion_user_id ON public.tour_completion(user_id);
CREATE INDEX IF NOT EXISTS idx_tour_completion_tour_type ON public.tour_completion(tour_type);

-- Enable RLS
ALTER TABLE public.tour_completion ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own tour completion
CREATE POLICY "Users can manage their own tour completion" ON public.tour_completion
  FOR ALL USING (auth.uid() = user_id);

-- Create policy for admins to view all tour completion
CREATE POLICY "Admins can view all tour completion" ON public.tour_completion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

