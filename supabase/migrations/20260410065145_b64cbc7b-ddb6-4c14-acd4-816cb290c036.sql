
-- Cache table for IMEI/TAC to device mapping (learning from manual entries)
CREATE TABLE public.imei_device_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tac text NOT NULL, -- first 8 digits of IMEI (Type Allocation Code)
  marca text NOT NULL,
  modelo text NOT NULL,
  cor text,
  capacidade text,
  fonte text NOT NULL DEFAULT 'manual', -- manual, api_externa
  vezes_usado integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique on tac + marca + modelo to avoid duplicates
CREATE UNIQUE INDEX idx_imei_device_cache_tac_unique
  ON public.imei_device_cache (tac, marca, modelo);

-- Enable RLS
ALTER TABLE public.imei_device_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access" ON public.imei_device_cache FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.imei_device_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER update_imei_device_cache_updated_at
  BEFORE UPDATE ON public.imei_device_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();
