-- Create service_operation_logs table for tracking all service additions
CREATE TABLE IF NOT EXISTS public.service_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('add', 'update', 'remove')),
  service_id UUID,
  service_name TEXT,
  quantity INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retried')),
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  client_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_operation_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admins can view all operation logs"
  ON public.service_operation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Workers can view their own logs
CREATE POLICY "Workers can view their own operation logs"
  ON public.service_operation_logs
  FOR SELECT
  TO authenticated
  USING (worker_id = auth.uid());

-- System can insert logs (for edge functions)
CREATE POLICY "Service role can insert operation logs"
  ON public.service_operation_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_service_operation_logs_booking_id ON public.service_operation_logs(booking_id);
CREATE INDEX idx_service_operation_logs_worker_id ON public.service_operation_logs(worker_id);
CREATE INDEX idx_service_operation_logs_status ON public.service_operation_logs(status);
CREATE INDEX idx_service_operation_logs_created_at ON public.service_operation_logs(created_at DESC);
CREATE INDEX idx_service_operation_logs_error_code ON public.service_operation_logs(error_code) WHERE error_code IS NOT NULL;

-- Create view for admin analytics
CREATE OR REPLACE VIEW public.v_service_operation_analytics AS
SELECT
  DATE_TRUNC('hour', created_at) as time_bucket,
  operation_type,
  status,
  COUNT(*) as operation_count,
  AVG(duration_ms) as avg_duration_ms,
  COUNT(DISTINCT worker_id) as unique_workers,
  COUNT(DISTINCT booking_id) as unique_bookings,
  SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) as operations_with_retries
FROM public.service_operation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY time_bucket, operation_type, status
ORDER BY time_bucket DESC;