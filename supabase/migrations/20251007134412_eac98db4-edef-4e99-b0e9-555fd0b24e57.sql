-- Add 'pending' to sms_status enum to fix notification logging
ALTER TYPE sms_status ADD VALUE IF NOT EXISTS 'pending';