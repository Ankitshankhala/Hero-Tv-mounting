-- Enable HTTP from Postgres for notification triggers (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;