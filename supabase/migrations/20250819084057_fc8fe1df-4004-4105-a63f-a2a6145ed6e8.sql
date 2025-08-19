-- Create worker booking preferences table for soft deletes and hiding
CREATE TABLE public.worker_booking_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  hidden_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, booking_id)
);

-- Enable RLS
ALTER TABLE public.worker_booking_preferences ENABLE ROW LEVEL SECURITY;

-- Workers can manage their own preferences
CREATE POLICY "Workers can manage their own booking preferences" 
ON public.worker_booking_preferences 
FOR ALL 
USING (worker_id = auth.uid());

-- Admins can view all preferences
CREATE POLICY "Admins can view all booking preferences" 
ON public.worker_booking_preferences 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE id = auth.uid() AND role = 'admin'::user_role
));

-- Add trigger for updated_at
CREATE TRIGGER update_worker_booking_preferences_updated_at
BEFORE UPDATE ON public.worker_booking_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();