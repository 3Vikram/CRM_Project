-- Ledgers the Accounts UI (frontend/src/lib/accounting.ts CHART) uses but
-- migration 001 didn't seed, plus the purchase-invoice, bank-payment and
-- server-assigned-numbering tables that back the Accounts screens.

INSERT INTO ledgers(company_id,group_id,code,name,nature,current_classification,opening_balance_eligible,bill_wise,schedule_iii_map)
SELECT c.id,ag.id,l.code,l.name,l.nature::account_nature,l.classification::current_classification,l.opening,l.bill_wise,l.schedule_map
FROM companies c CROSS JOIN (VALUES
  ('1300','Vendor Advances','asset','current',true,true,'Other current assets'),
  ('2200','Accrued Expenses','liability','current',true,false,'Other current liabilities'),
  ('3030','Retained Earnings','equity','not_applicable',true,false,'Other equity'),
  ('4020','Service Income','income','not_applicable',false,false,'Revenue from operations'),
  ('4030','Other Income','income','not_applicable',false,false,'Other income'),
  ('5040','Utilities Expense','expense','not_applicable',false,false,'Other expenses'),
  ('5050','Travel Expense','expense','not_applicable',false,false,'Other expenses'),
  ('5060','Professional Fees','expense','not_applicable',false,false,'Other expenses'),
  ('5070','Other Expenses','expense','not_applicable',false,false,'Other expenses')
) l(code,name,nature,classification,opening,bill_wise,schedule_map)
JOIN account_groups ag ON ag.company_id=c.id AND ag.nature=l.nature::account_nature
ON CONFLICT(company_id,code) DO NOTHING;

-- No voucher_status enum change needed: a draft voucher that was never
-- posted has no ledger impact, so "cancel" on it is a plain DELETE (the
-- immutable_posted_voucher trigger only blocks posted/reversed rows), and a
-- posted voucher is already cancelled by reversing it (existing endpoint).

-- Journal register's "Invoice number" field, distinct from external_reference ("Reference").
ALTER TABLE vouchers ADD COLUMN invoice_reference text;

CREATE TABLE purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  number text NOT NULL,
  vendor text NOT NULL,
  vendor_gstin text,
  vendor_invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  tax_mode text NOT NULL CHECK (tax_mode IN ('intra', 'inter', 'none')),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_voucher_id uuid REFERENCES vouchers(id),
  legacy_client_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX purchase_invoices_number_idx ON purchase_invoices(company_id, lower(number)) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX purchase_invoices_vendor_ref_idx ON purchase_invoices(company_id, lower(vendor), lower(vendor_invoice_number)) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX purchase_invoices_legacy_idx ON purchase_invoices(company_id, legacy_client_id) WHERE legacy_client_id IS NOT NULL;

CREATE TABLE purchase_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number > 0),
  description text NOT NULL,
  quantity numeric(20,4) NOT NULL CHECK (quantity > 0),
  rate numeric(20,4) NOT NULL CHECK (rate > 0),
  gst_rate numeric(5,2) NOT NULL DEFAULT 0,
  ledger_id uuid NOT NULL REFERENCES ledgers(id),
  UNIQUE (purchase_invoice_id, line_number)
);

CREATE TABLE bank_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  number text NOT NULL,
  payment_date date NOT NULL,
  payee text NOT NULL,
  bank_ledger_id uuid NOT NULL REFERENCES ledgers(id),
  category_ledger_id uuid REFERENCES ledgers(id),
  linked_purchase_invoice_id uuid REFERENCES purchase_invoices(id),
  mode text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  amount numeric(20,4) NOT NULL CHECK (amount > 0),
  narration text NOT NULL DEFAULT '',
  clearance text NOT NULL DEFAULT 'Pending' CHECK (clearance IN ('Pending', 'Cleared')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_voucher_id uuid REFERENCES vouchers(id),
  legacy_client_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (category_ledger_id IS NOT NULL OR linked_purchase_invoice_id IS NOT NULL)
);
CREATE UNIQUE INDEX bank_payments_number_idx ON bank_payments(company_id, lower(number)) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX bank_payments_legacy_idx ON bank_payments(company_id, legacy_client_id) WHERE legacy_client_id IS NOT NULL;

-- Purchase invoice and bank payment numbers stay client-suggested/editable
-- text, same as the old localStorage UI (`PI-0001`, `BP-0001` from the
-- current row count) — the partial unique indexes above are what actually
-- enforce no-duplicates now, so no server-side sequence table is needed here.

-- One-time browser-data import can't create the same voucher twice.
CREATE UNIQUE INDEX vouchers_legacy_browser_idx ON vouchers(company_id, source_id) WHERE source_type = 'legacy_browser';
