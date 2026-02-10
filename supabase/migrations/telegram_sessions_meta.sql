ALTER TABLE public.telegram_sessions
ADD COLUMN IF NOT EXISTS session_meta JSONB;
