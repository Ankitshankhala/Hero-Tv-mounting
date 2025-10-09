-- Create admin impersonation sessions table for audit logging
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  ip_address text,
  user_agent text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_admin ON public.admin_impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_worker ON public.admin_impersonation_sessions(worker_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_active ON public.admin_impersonation_sessions(worker_id) WHERE ended_at IS NULL;

-- Enable RLS
ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can view impersonation logs
CREATE POLICY "Admins can view all impersonation sessions"
ON public.admin_impersonation_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can create impersonation sessions
CREATE POLICY "Admins can create impersonation sessions"
ON public.admin_impersonation_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can update (end) their own impersonation sessions
CREATE POLICY "Admins can end their own impersonation sessions"
ON public.admin_impersonation_sessions
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Function to start an impersonation session
CREATE OR REPLACE FUNCTION public.start_impersonation_session(
  p_worker_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_id uuid;
  admin_role text;
  worker_role text;
BEGIN
  -- Verify caller is admin
  SELECT role INTO admin_role FROM public.users WHERE id = auth.uid();
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can start impersonation sessions';
  END IF;
  
  -- Verify target is a worker
  SELECT role INTO worker_role FROM public.users WHERE id = p_worker_id;
  IF worker_role != 'worker' THEN
    RAISE EXCEPTION 'Can only impersonate worker accounts';
  END IF;
  
  -- End any existing active sessions for this admin
  UPDATE public.admin_impersonation_sessions
  SET ended_at = now()
  WHERE admin_id = auth.uid() AND ended_at IS NULL;
  
  -- Create new session
  INSERT INTO public.admin_impersonation_sessions (
    admin_id, worker_id, reason
  ) VALUES (
    auth.uid(), p_worker_id, p_reason
  ) RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

-- Function to end an impersonation session
CREATE OR REPLACE FUNCTION public.end_impersonation_session(p_session_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If session_id provided, end that specific session
  IF p_session_id IS NOT NULL THEN
    UPDATE public.admin_impersonation_sessions
    SET ended_at = now()
    WHERE id = p_session_id AND admin_id = auth.uid() AND ended_at IS NULL;
  ELSE
    -- Otherwise end all active sessions for this admin
    UPDATE public.admin_impersonation_sessions
    SET ended_at = now()
    WHERE admin_id = auth.uid() AND ended_at IS NULL;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to check if user is currently impersonating
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE (
  session_id uuid,
  worker_id uuid,
  worker_name text,
  worker_email text,
  started_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ais.id,
    ais.worker_id,
    u.name,
    u.email,
    ais.started_at
  FROM public.admin_impersonation_sessions ais
  JOIN public.users u ON u.id = ais.worker_id
  WHERE ais.admin_id = auth.uid() 
    AND ais.ended_at IS NULL
  ORDER BY ais.started_at DESC
  LIMIT 1;
END;
$$;