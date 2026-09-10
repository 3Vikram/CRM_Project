CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_nature AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
CREATE TYPE current_classification AS ENUM ('current', 'non_current', 'not_applicable');
CREATE TYPE voucher_status AS ENUM ('draft', 'submitted', 'approved', 'posted', 'reversed');
CREATE TYPE voucher_type AS ENUM ('sales', 'purchase', 'receipt', 'payment', 'contra', 'journal', 'debit_note', 'credit_note', 'opening', 'payroll', 'depreciation', 'loan', 'interest_accrual', 'tax', 'reversal');
CREATE TYPE migration_status AS ENUM ('uploaded', 'validating', 'mapping_required', 'ready', 'imported', 'reconciled', 'approved', 'failed', 'cancelled', 'rolled_back', 'corrective_action_required');

CREATE TABLE companies (
  id text PRIMARY KEY,
  legal_name text NOT NULL,
  gstin text,
  pan text,
  reporting_currency char(3) NOT NULL DEFAULT 'INR',
  books_beginning_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  closed_at timestamptz,
  UNIQUE (company_id, id), UNIQUE (company_id, name),
  CHECK (starts_on <= ends_on)
);

CREATE TABLE period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  locked_through date NOT NULL,
  reason text NOT NULL,
  locked_by text NOT NULL,
  reopened_at timestamptz,
  reopened_by text,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  parent_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  nature account_nature NOT NULL,
  current_classification current_classification NOT NULL DEFAULT 'not_applicable',
  schedule_iii_map text,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, id), UNIQUE (company_id, code), UNIQUE (company_id, name),
  FOREIGN KEY (company_id, parent_id) REFERENCES account_groups(company_id, id)
);

CREATE TABLE ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  group_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  nature account_nature NOT NULL,
  current_classification current_classification NOT NULL DEFAULT 'not_applicable',
  currency char(3) NOT NULL DEFAULT 'INR',
  opening_balance_eligible boolean NOT NULL DEFAULT false,
  bill_wise boolean NOT NULL DEFAULT false,
  schedule_iii_map text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id), UNIQUE (company_id, code), UNIQUE (company_id, name),
  FOREIGN KEY (company_id, group_id) REFERENCES account_groups(company_id, id)
);

CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  financial_year_id uuid NOT NULL,
  voucher_type voucher_type NOT NULL,
  voucher_number text NOT NULL,
  voucher_date date NOT NULL,
  status voucher_status NOT NULL DEFAULT 'draft',
  narration text NOT NULL DEFAULT '',
  external_reference text,
  idempotency_key text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id text,
  created_by text NOT NULL,
  submitted_by text,
  approved_by text,
  posted_by text,
  posted_at timestamptz,
  reversed_by_voucher_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id), UNIQUE (company_id, voucher_type, voucher_number), UNIQUE (company_id, idempotency_key),
  FOREIGN KEY (company_id, financial_year_id) REFERENCES financial_years(company_id, id),
  FOREIGN KEY (company_id, reversed_by_voucher_id) REFERENCES vouchers(company_id, id),
  CHECK ((status <> 'posted' AND status <> 'reversed') OR posted_at IS NOT NULL)
);

CREATE TABLE voucher_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  voucher_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  ledger_id uuid NOT NULL,
  debit numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  narration text NOT NULL DEFAULT '',
  party_id uuid,
  bill_reference text,
  cost_centre_id uuid,
  UNIQUE (company_id, voucher_id, line_number),
  FOREIGN KEY (company_id, voucher_id) REFERENCES vouchers(company_id, id),
  FOREIGN KEY (company_id, ledger_id) REFERENCES ledgers(company_id, id),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE TABLE voucher_sequences (
  company_id text NOT NULL REFERENCES companies(id),
  financial_year_id uuid NOT NULL,
  voucher_type voucher_type NOT NULL,
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0),
  PRIMARY KEY (company_id, financial_year_id, voucher_type),
  FOREIGN KEY (company_id, financial_year_id) REFERENCES financial_years(company_id, id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id),
  source_type text NOT NULL,
  source_company text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('cutover', 'full_history')),
  cutover_date date,
  dry_run boolean NOT NULL DEFAULT true,
  status migration_status NOT NULL DEFAULT 'uploaded',
  created_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mode <> 'cutover' OR cutover_date IS NOT NULL),
  UNIQUE (company_id, id)
);

CREATE TABLE migration_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  job_id uuid NOT NULL,
  file_name text NOT NULL,
  content_hash char(64) NOT NULL,
  storage_key text NOT NULL,
  extraction_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, job_id) REFERENCES migration_jobs(company_id, id),
  UNIQUE (company_id, job_id, content_hash)
);

CREATE TABLE migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  job_id uuid NOT NULL,
  file_id uuid,
  source_record_id text,
  source_record_type text NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  fingerprint char(64),
  duplicate_classification text,
  validation_status text NOT NULL DEFAULT 'pending',
  mapping_status text NOT NULL DEFAULT 'pending',
  target_type text,
  target_id uuid,
  posted_voucher_id uuid,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, job_id) REFERENCES migration_jobs(company_id, id),
  FOREIGN KEY (company_id, file_id) REFERENCES migration_files(company_id, id),
  FOREIGN KEY (company_id, posted_voucher_id) REFERENCES vouchers(company_id, id)
);

CREATE TABLE migration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  job_id uuid NOT NULL,
  source_type text NOT NULL,
  source_key text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  decision text NOT NULL,
  confidence numeric(5,4),
  reason text,
  decided_by text NOT NULL,
  FOREIGN KEY (company_id, job_id) REFERENCES migration_jobs(company_id, id)
);

CREATE TABLE migration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  job_id uuid NOT NULL,
  record_id uuid,
  severity text NOT NULL CHECK (severity IN ('error', 'warning', 'exception')),
  code text NOT NULL,
  message text NOT NULL,
  approved_by text,
  approval_reason text,
  FOREIGN KEY (company_id, job_id) REFERENCES migration_jobs(company_id, id),
  FOREIGN KEY (company_id, record_id) REFERENCES migration_records(company_id, id)
);

CREATE TABLE migration_reconciliation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  job_id uuid NOT NULL,
  category text NOT NULL,
  source_value numeric(20,4) NOT NULL,
  imported_value numeric(20,4) NOT NULL,
  difference numeric(20,4) GENERATED ALWAYS AS (imported_value - source_value) STORED,
  status text NOT NULL,
  explanation text,
  reviewed_by text,
  reviewed_at timestamptz,
  FOREIGN KEY (company_id, job_id) REFERENCES migration_jobs(company_id, id)
);

-- Posted entries are append-only. Reversals create a new voucher instead.
CREATE FUNCTION prevent_posted_voucher_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Posted vouchers are immutable; create a reversal';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_posted_voucher BEFORE UPDATE OR DELETE ON vouchers
FOR EACH ROW EXECUTE FUNCTION prevent_posted_voucher_mutation();

CREATE FUNCTION prevent_posted_line_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status voucher_status;
BEGIN
  SELECT status INTO parent_status FROM vouchers WHERE id = COALESCE(NEW.voucher_id, OLD.voucher_id) AND company_id = COALESCE(NEW.company_id, OLD.company_id);
  IF parent_status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'Posted voucher lines are immutable; create a reversal';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_posted_lines BEFORE INSERT OR UPDATE OR DELETE ON voucher_lines
FOR EACH ROW EXECUTE FUNCTION prevent_posted_line_mutation();

CREATE FUNCTION validate_voucher_before_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE debit_total numeric(20,4); credit_total numeric(20,4); line_count integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'posted' THEN
    RAISE EXCEPTION 'Vouchers must be created as drafts before posting';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'posted' AND OLD.status <> 'posted' THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO debit_total, credit_total, line_count
    FROM voucher_lines WHERE company_id=NEW.company_id AND voucher_id=NEW.id;
    IF line_count < 2 OR debit_total <> credit_total THEN RAISE EXCEPTION 'Voucher must contain at least two balanced lines'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER balanced_before_posting BEFORE INSERT OR UPDATE ON vouchers
FOR EACH ROW EXECUTE FUNCTION validate_voucher_before_posting();

CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are immutable'; END $$;
CREATE TRIGGER immutable_audit_events BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE FUNCTION preserve_migration_raw_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.raw_data IS DISTINCT FROM OLD.raw_data THEN RAISE EXCEPTION 'Raw migration evidence is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_migration_raw_data BEFORE UPDATE ON migration_records
FOR EACH ROW EXECUTE FUNCTION preserve_migration_raw_data();

CREATE INDEX voucher_company_date_idx ON vouchers(company_id, voucher_date) WHERE status IN ('posted', 'reversed');
CREATE INDEX voucher_lines_company_ledger_idx ON voucher_lines(company_id, ledger_id);
CREATE INDEX migration_records_job_idx ON migration_records(company_id, job_id);
CREATE UNIQUE INDEX one_reversal_per_voucher_idx ON vouchers(company_id, source_id)
  WHERE source_type = 'reversal' AND status IN ('posted', 'reversed');

INSERT INTO companies (id, legal_name, gstin, pan, books_beginning_date) VALUES
('3vikram', '3Vikram Technologies', '29APPPK7534R1ZR', 'APPPK7534R', DATE '2025-04-01'),
('synov', 'SYNOV IT Services Private Limited', '29ABICS1686C1Z4', 'ABICS1686C', DATE '2023-04-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_years(company_id,name,starts_on,ends_on)
SELECT c.id,y.name,y.starts_on,y.ends_on FROM companies c CROSS JOIN (VALUES
  ('2025-26',DATE '2025-04-01',DATE '2026-03-31'),
  ('2026-27',DATE '2026-04-01',DATE '2027-03-31')
) y(name,starts_on,ends_on) ON CONFLICT(company_id,name) DO NOTHING;

INSERT INTO account_groups(company_id,code,name,nature,current_classification,schedule_iii_map)
SELECT c.id,g.code,g.name,g.nature::account_nature,g.classification::current_classification,g.schedule_map
FROM companies c CROSS JOIN (VALUES
  ('1000','Assets','asset','current','Assets'),('2000','Liabilities','liability','current','Liabilities'),
  ('3000','Equity','equity','not_applicable','Equity'),('4000','Income','income','not_applicable','Revenue'),
  ('5000','Expenses','expense','not_applicable','Expenses')
) g(code,name,nature,classification,schedule_map) ON CONFLICT(company_id,code) DO NOTHING;

INSERT INTO ledgers(company_id,group_id,code,name,nature,current_classification,opening_balance_eligible,bill_wise,schedule_iii_map)
SELECT c.id,ag.id,l.code,l.name,l.nature::account_nature,l.classification::current_classification,l.opening,l.bill_wise,l.schedule_map
FROM companies c CROSS JOIN (VALUES
  ('1010','Cash','asset','current',true,false,'Cash and cash equivalents'),
  ('1020','Main Bank','asset','current',true,false,'Cash and cash equivalents'),
  ('1100','Accounts Receivable','asset','current',true,true,'Trade receivables'),
  ('1200','Input GST','asset','current',true,false,'Other current assets'),
  ('2010','Accounts Payable','liability','current',true,true,'Trade payables'),
  ('2100','Output GST','liability','current',true,false,'Other current liabilities'),
  ('3010','Capital','equity','not_applicable',true,false,'Share capital / proprietor capital'),
  ('3020','Migration Clearing','equity','not_applicable',true,false,'Other equity'),
  ('4010','Sales Income','income','not_applicable',false,false,'Revenue from operations'),
  ('5010','Purchases','expense','not_applicable',false,false,'Purchases'),
  ('5020','Rent Expense','expense','not_applicable',false,false,'Other expenses'),
  ('5030','Salaries Expense','expense','not_applicable',false,false,'Employee benefits expense')
) l(code,name,nature,classification,opening,bill_wise,schedule_map)
JOIN account_groups ag ON ag.company_id=c.id AND ag.nature=l.nature::account_nature
ON CONFLICT(company_id,code) DO NOTHING;
