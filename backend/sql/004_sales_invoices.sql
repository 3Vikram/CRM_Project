-- Issued sale invoices and a per-user autosaved working draft, replacing
-- the frontend's localStorage draft (crm.sale-invoice.draft.v1) and the
-- fact that Print used to be the end of the flow with nothing saved.

CREATE TABLE sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  buyer_name text NOT NULL,
  buyer_gstin text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  draft jsonb NOT NULL,
  computed jsonb NOT NULL,
  grand_total numeric(20,4) NOT NULL,
  posted_voucher_id uuid REFERENCES vouchers(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sales_invoices_number_idx ON sales_invoices(company_id, lower(invoice_number)) WHERE status <> 'cancelled';

CREATE TABLE invoice_drafts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  draft jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
