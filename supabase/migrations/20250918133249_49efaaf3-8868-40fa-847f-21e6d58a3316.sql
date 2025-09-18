-- Phase 1: Drop empty/unused tables that are cluttering the database
DROP TABLE IF EXISTS booking_service_modifications CASCADE;
DROP TABLE IF EXISTS manual_charges CASCADE;
DROP TABLE IF EXISTS onsite_charges CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS worker_booking_preferences CASCADE;
DROP TABLE IF EXISTS payment_sessions CASCADE;
DROP TABLE IF EXISTS upload_chunks_metadata CASCADE;