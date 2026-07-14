CREATE TABLE public.pending_authorizations (
  payment_intent_id text PRIMARY KEY,
  cart jsonb NOT NULL,
  reserved_worker_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only — no anon/authenticated grants.
GRANT ALL ON public.pending_authorizations TO service_role;

ALTER TABLE public.pending_authorizations ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: with RLS enabled and no policies, anon/authenticated
-- cannot read/write. service_role bypasses RLS.

CREATE INDEX pending_authorizations_created_at_idx
  ON public.pending_authorizations (created_at);