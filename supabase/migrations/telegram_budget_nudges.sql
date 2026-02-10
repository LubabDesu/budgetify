CREATE TABLE IF NOT EXISTS public.telegram_budget_nudges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  nudge_level INT NOT NULL CHECK (nudge_level IN (80, 100)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, period_start, nudge_level)
);

ALTER TABLE public.telegram_budget_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telegram nudges"
  ON public.telegram_budget_nudges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own telegram nudges"
  ON public.telegram_budget_nudges FOR ALL
  USING (auth.uid() = user_id);
