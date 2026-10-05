-- Jalankan sekali sebelum men-deploy worker antrean.
CREATE TABLE IF NOT EXISTS public.analisis_worker (
  analisis_id integer PRIMARY KEY REFERENCES public.analisis(id) ON DELETE CASCADE,
  token uuid NOT NULL,
  lease_until timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.claim_analisis_worker(p_analisis_id integer, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE claimed_count integer;
BEGIN
  INSERT INTO public.analisis_worker (analisis_id, token, lease_until)
  SELECT id, p_token, now() + interval '5 minutes'
  FROM public.analisis WHERE id = p_analisis_id AND status = 'berjalan'
  ON CONFLICT (analisis_id) DO UPDATE
    SET token = EXCLUDED.token, lease_until = EXCLUDED.lease_until
    WHERE analisis_worker.lease_until < now();
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_analisis_worker(p_analisis_id integer, p_token uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.analisis_worker WHERE analisis_id = p_analisis_id AND token = p_token;
$$;

REVOKE ALL ON public.analisis_worker FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_analisis_worker(integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_analisis_worker(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_analisis_worker(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_analisis_worker(integer, uuid) TO service_role;
