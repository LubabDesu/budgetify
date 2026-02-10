-- Recurring Payments Schema
-- Run this in your Supabase SQL Editor

-- 1. Create recurring_rules table
CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  interval INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create recurring_exceptions table
CREATE TABLE recurring_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES recurring_rules(id) ON DELETE CASCADE NOT NULL,
  occurrence_date DATE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('deleted', 'modified', 'paid')),
  modified_amount DECIMAL(12,2),
  modified_description TEXT,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rule_id, occurrence_date)
);

-- 3. Enable RLS
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_exceptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for recurring_rules
CREATE POLICY "Users can view their own recurring rules"
  ON recurring_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring rules"
  ON recurring_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring rules"
  ON recurring_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring rules"
  ON recurring_rules FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RLS Policies for recurring_exceptions (via rule ownership)
CREATE POLICY "Users can view exceptions for their rules"
  ON recurring_exceptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM recurring_rules 
    WHERE recurring_rules.id = recurring_exceptions.rule_id 
    AND recurring_rules.user_id = auth.uid()
  ));

CREATE POLICY "Users can create exceptions for their rules"
  ON recurring_exceptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM recurring_rules 
    WHERE recurring_rules.id = recurring_exceptions.rule_id 
    AND recurring_rules.user_id = auth.uid()
  ));

CREATE POLICY "Users can update exceptions for their rules"
  ON recurring_exceptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM recurring_rules 
    WHERE recurring_rules.id = recurring_exceptions.rule_id 
    AND recurring_rules.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete exceptions for their rules"
  ON recurring_exceptions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM recurring_rules 
    WHERE recurring_rules.id = recurring_exceptions.rule_id 
    AND recurring_rules.user_id = auth.uid()
  ));

-- 6. Indexes for performance
CREATE INDEX idx_recurring_rules_user_id ON recurring_rules(user_id);
CREATE INDEX idx_recurring_rules_start_date ON recurring_rules(start_date);
CREATE INDEX idx_recurring_exceptions_rule_id ON recurring_exceptions(rule_id);
CREATE INDEX idx_recurring_exceptions_occurrence_date ON recurring_exceptions(occurrence_date);
