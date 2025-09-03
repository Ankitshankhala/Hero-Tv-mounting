-- Enable real-time for invoices table
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;