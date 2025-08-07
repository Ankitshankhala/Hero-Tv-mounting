-- Remove tax from all existing invoices to ensure consistency
UPDATE invoices 
SET 
  tax_amount = 0,
  total_amount = amount,
  tax_rate = 0
WHERE tax_amount > 0 OR total_amount != amount;

-- Update the invoice generation trigger to ensure no tax is applied
-- This is handled in the edge functions but ensuring database consistency