-- Users, login, and the platform-level columns needed to move sellers and
-- workflow settings out of hardcoded backend config and into the database.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('administrator', 'accountant', 'maker', 'approver', 'auditor', 'read_only_management', 'migration_operator')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Audit events are also written for platform actions (login, CRM writes) that
-- have no company context.
ALTER TABLE audit_events ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE companies ADD COLUMN require_maker_checker boolean NOT NULL DEFAULT false;

-- Seller/invoice presets, formerly hardcoded in backend/src/config/entities.ts.
-- Shape matches the shared `Entity` type minus `id` (= companies.id) and `name`
-- (= companies.legal_name).
ALTER TABLE companies ADD COLUMN profile jsonb;

UPDATE companies SET profile = '{
  "shortName": "3VIKRAM",
  "legalName": "3Vikram Technologies - 2025-26",
  "address": "No.1/5 Santosh Complex Basavanagudi, Near Armugam Circle, Bengaluru - 560004",
  "stateCode": "29",
  "stateName": "Karnataka",
  "email": "pavan@3vikram.in",
  "contact": "9901574446,9740997444",
  "msme": "UDYAM-KR-03-0029793",
  "invoicePrefix": "3VT/",
  "eInvoiceDefault": true,
  "bank": {
    "holderName": "3VIKRAM TECHNOLOGIES",
    "bankName": "HDFC BANK",
    "accountNo": "04462000005256",
    "branch": "BASAVANAGUDI, GANDHI BAZAAR",
    "ifsc": "HDFC0000446"
  },
  "declaration": "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
  "terms": "1. Interest @24% p.a will be charged on delayed Payments, outstanding payment made only in the form of Demand Draft/ RTGS.\n2. Goods once sold cannot be returned or Exchanged short shipment of materials should be bought to our notice immediately.\n3. Our company is under MSME category. kindly release the payment with in the due date. MSME:UDYAM-KR-03-0029793.",
  "remarksTemplate": "Being Rental Invoice Raised for the Month of {month} ({seller})"
}'::jsonb WHERE id = '3vikram';

UPDATE companies SET profile = '{
  "shortName": "KVAS",
  "legalName": "SYNOV IT SERVICES PRIVATE LIMITED - (23-24)",
  "address": "91 Springboard Business Hub Pvt Ltd, Gopala Krishna Complex, No. 45/3, Residency Road, MG Road, Bengaluru-560025",
  "stateCode": "29",
  "stateName": "Karnataka",
  "email": "Pk.k@synov.in/sales@synov.in",
  "contact": "",
  "cin": "U72900KA2022PTC159475",
  "invoicePrefix": "SISPL/",
  "eInvoiceDefault": false,
  "bank": {
    "holderName": "SYNOV IT SERVICES PRIVATE LIMITED",
    "bankName": "ICICI BANK",
    "accountNo": "000000000000000",
    "branch": "BENGALURU",
    "ifsc": "ICIC0000000"
  },
  "declaration": "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
  "terms": "1. Interest @24% p.a will be charged on delayed Payments.\n2. Goods once sold cannot be returned or Exchanged. Short shipment of materials should be bought to our notice immediately.",
  "remarksTemplate": "Being Rental Invoice Raised for the Month of {month} ({seller})"
}'::jsonb WHERE id = 'synov';

ALTER TABLE companies ALTER COLUMN profile SET NOT NULL;
