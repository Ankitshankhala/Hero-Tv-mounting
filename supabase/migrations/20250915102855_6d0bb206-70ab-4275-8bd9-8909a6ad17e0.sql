-- Update RLS policy to allow service role operations for ZIP code imports
DROP POLICY IF EXISTS "Admins can manage comprehensive ZIP codes" ON public.comprehensive_zip_codes;

-- Create enhanced policy that allows both admin users and service role
CREATE POLICY "Enhanced admin and service role access for comprehensive ZIP codes" 
ON public.comprehensive_zip_codes 
FOR ALL 
USING (
  -- Allow service role (for edge functions and system operations)
  (auth.role() = 'service_role') OR 
  -- Allow admin users
  (EXISTS ( 
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
  ))
)
WITH CHECK (
  -- Same conditions for inserts/updates
  (auth.role() = 'service_role') OR 
  (EXISTS ( 
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
  ))
);