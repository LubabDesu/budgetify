CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id BIGINT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  state TEXT NOT NULL,
  clarification_field TEXT,
  pending_transactions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telegram sessions"
  ON public.telegram_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own telegram sessions"
  ON public.telegram_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat_id ON public.telegram_sessions(chat_id);
