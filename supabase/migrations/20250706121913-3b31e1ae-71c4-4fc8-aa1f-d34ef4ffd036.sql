-- Update transactions table default currency to USD
ALTER TABLE public.transactions ALTER COLUMN currency SET DEFAULT 'USD';

-- Create state tax rates configuration table
CREATE TABLE public.state_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL UNIQUE,
  state_name TEXT NOT NULL,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on state_tax_rates
ALTER TABLE public.state_tax_rates ENABLE ROW LEVEL SECURITY;

-- Create policy for state tax rates (public read access)
CREATE POLICY "Anyone can view state tax rates" 
ON public.state_tax_rates 
FOR SELECT 
USING (is_active = true);

-- Create policy for admins to manage tax rates
CREATE POLICY "Admins can manage state tax rates" 
ON public.state_tax_rates 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE users.id = auth.uid() AND users.role = 'admin'
));

-- Insert common US state tax rates
INSERT INTO public.state_tax_rates (state_code, state_name, tax_rate) VALUES
('AL', 'Alabama', 0.0400),
('AK', 'Alaska', 0.0000),
('AZ', 'Arizona', 0.0560),
('AR', 'Arkansas', 0.0650),
('CA', 'California', 0.0725),
('CO', 'Colorado', 0.0290),
('CT', 'Connecticut', 0.0635),
('DE', 'Delaware', 0.0000),
('FL', 'Florida', 0.0600),
('GA', 'Georgia', 0.0400),
('HI', 'Hawaii', 0.0400),
('ID', 'Idaho', 0.0600),
('IL', 'Illinois', 0.0625),
('IN', 'Indiana', 0.0700),
('IA', 'Iowa', 0.0600),
('KS', 'Kansas', 0.0650),
('KY', 'Kentucky', 0.0600),
('LA', 'Louisiana', 0.0445),
('ME', 'Maine', 0.0550),
('MD', 'Maryland', 0.0600),
('MA', 'Massachusetts', 0.0625),
('MI', 'Michigan', 0.0600),
('MN', 'Minnesota', 0.0688),
('MS', 'Mississippi', 0.0700),
('MO', 'Missouri', 0.0423),
('MT', 'Montana', 0.0000),
('NE', 'Nebraska', 0.0550),
('NV', 'Nevada', 0.0685),
('NH', 'New Hampshire', 0.0000),
('NJ', 'New Jersey', 0.0663),
('NM', 'New Mexico', 0.0513),
('NY', 'New York', 0.0800),
('NC', 'North Carolina', 0.0475),
('ND', 'North Dakota', 0.0500),
('OH', 'Ohio', 0.0575),
('OK', 'Oklahoma', 0.0450),
('OR', 'Oregon', 0.0000),
('PA', 'Pennsylvania', 0.0600),
('RI', 'Rhode Island', 0.0700),
('SC', 'South Carolina', 0.0600),
('SD', 'South Dakota', 0.0450),
('TN', 'Tennessee', 0.0700),
('TX', 'Texas', 0.0625),
('UT', 'Utah', 0.0613),
('VT', 'Vermont', 0.0600),
('VA', 'Virginia', 0.0530),
('WA', 'Washington', 0.0650),
('WV', 'West Virginia', 0.0600),
('WI', 'Wisconsin', 0.0500),
('WY', 'Wyoming', 0.0400),
('DC', 'District of Columbia', 0.0600);

-- Add state tax information to invoices table
ALTER TABLE public.invoices ADD COLUMN state_code VARCHAR(2);
ALTER TABLE public.invoices ADD COLUMN tax_rate NUMERIC(5,4);
ALTER TABLE public.invoices ADD COLUMN business_license TEXT DEFAULT 'TX-123456789';

-- Create function to get state tax rate by zip code (simplified - just first 5 digits)
CREATE OR REPLACE FUNCTION public.get_tax_rate_by_state(state_abbreviation TEXT)
RETURNS NUMERIC AS $$
DECLARE
  tax_rate NUMERIC;
BEGIN
  SELECT str.tax_rate INTO tax_rate
  FROM public.state_tax_rates str
  WHERE str.state_code = UPPER(state_abbreviation)
  AND str.is_active = true;
  
  RETURN COALESCE(tax_rate, 0.0000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;