-- Add budget columns to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS budget_period TEXT DEFAULT 'monthly' CHECK (budget_period IN ('monthly', 'weekly', 'yearly', 'daily'));

-- Create a view for budget progress (optional ideation)
-- This view helps calculate how much has been spent per category in the current month
CREATE OR REPLACE VIEW category_budget_progress AS
SELECT 
    c.id AS category_id,
    c.user_id,
    c.name AS category_name,
    c.budget_limit,
    c.budget_period,
    COALESCE(SUM(t.amount), 0) AS current_spending,
    CASE 
        WHEN c.budget_limit > 0 THEN (COALESCE(SUM(t.amount), 0) / c.budget_limit) * 100
        ELSE 0 
    END AS progress_percentage
FROM categories c
LEFT JOIN transactions t ON c.id = t.category_id 
    AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
    AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE c.budget_limit IS NOT NULL
GROUP BY c.id, c.user_id, c.name, c.budget_limit, c.budget_period;
