-- Create booking_services table to support multiple services per booking
CREATE TABLE public.booking_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  service_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

-- Create policies for booking services
CREATE POLICY "Admins can manage all booking services" 
ON public.booking_services 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Workers can view booking services for their bookings" 
ON public.booking_services 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings b 
  WHERE b.id = booking_services.booking_id AND b.worker_id = auth.uid()
));

CREATE POLICY "Customers can view booking services for their bookings" 
ON public.booking_services 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings b 
  WHERE b.id = booking_services.booking_id AND b.customer_id = auth.uid()
));

CREATE POLICY "Workers can modify booking services for their bookings" 
ON public.booking_services 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.bookings b 
  WHERE b.id = booking_services.booking_id AND b.worker_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_booking_services_updated_at
BEFORE UPDATE ON public.booking_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for booking_services
ALTER TABLE public.booking_services REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_services;

-- Create invoice_service_modifications table for audit trail
CREATE TABLE public.invoice_service_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  modification_type TEXT NOT NULL, -- 'add', 'remove', 'modify'
  service_name TEXT NOT NULL,
  old_configuration JSONB DEFAULT '{}',
  new_configuration JSONB DEFAULT '{}',
  price_change NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.invoice_service_modifications ENABLE ROW LEVEL SECURITY;

-- Create policies for invoice service modifications
CREATE POLICY "Admins can view all modifications" 
ON public.invoice_service_modifications 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Workers can view their modifications" 
ON public.invoice_service_modifications 
FOR SELECT 
USING (worker_id = auth.uid());

CREATE POLICY "Workers can create modifications" 
ON public.invoice_service_modifications 
FOR INSERT 
WITH CHECK (worker_id = auth.uid());

-- Enable realtime for invoice modifications
ALTER TABLE public.invoice_service_modifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_service_modifications;