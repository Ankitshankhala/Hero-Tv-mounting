-- Add cron job for checking expired acknowledgments every 5 minutes
SELECT cron.schedule(
  'check-expired-acknowledgments',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT public.reassign_expired_acknowledgments();
  $$
);