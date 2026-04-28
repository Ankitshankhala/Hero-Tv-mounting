-- Track per-state ZCTA import progress so import-zcta-data can be resumed.
CREATE TABLE IF NOT EXISTS public.zcta_import_state (
  state_abbr text PRIMARY KEY,
  feature_offset integer NOT NULL DEFAULT 0,
  total_features integer,
  completed boolean NOT NULL DEFAULT false,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zcta_import_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read zcta_import_state"
ON public.zcta_import_state FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Service role manages writes (RLS is bypassed for service role anyway, but
-- include explicit policy so the table is documented).
CREATE POLICY "Service role manages zcta_import_state"
ON public.zcta_import_state FOR ALL
USING (true) WITH CHECK (true);
