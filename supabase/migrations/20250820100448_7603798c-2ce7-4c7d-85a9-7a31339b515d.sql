-- First, update captured bookings to completed status and archived
UPDATE public.bookings 
SET 
  status = 'completed',
  payment_status = 'captured',
  is_archived = true,
  updated_at = now()
WHERE id IN (
  '7b488b56-3b36-4057-80c4-2f8d7b8db288',
  '11d71f72-1c1c-4b40-84fd-04817e774831'
);

-- For cancelled/refunded bookings, set them to completed status with refunded payment
-- This satisfies the constraint while marking them as non-actionable
UPDATE public.bookings 
SET 
  status = 'completed',
  payment_status = 'refunded',
  is_archived = true,
  updated_at = now()
WHERE id IN (
  '5f857ca3-efea-4253-b66b-94ebe6478bfb',
  '7ff8fd9b-b3e4-4ffa-b986-a9551ace5f9a',
  '0fdac303-53af-4de9-9cbb-5d0d6ec3ab24',
  'a33df3f1-9ea9-4188-99a0-819eb369caaf'
);