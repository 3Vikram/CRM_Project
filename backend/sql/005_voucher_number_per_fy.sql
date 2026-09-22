-- Voucher numbers reset per financial year (see nextVoucherNumber in
-- service.ts, keyed by company_id+financial_year_id+voucher_type), but the
-- table's uniqueness constraint didn't include financial_year_id — so the
-- first voucher of a type in any new financial year collided with the first
-- voucher of that type from a prior financial year (e.g. two different
-- vouchers both wanting "PURCHASE-000001").
ALTER TABLE vouchers DROP CONSTRAINT vouchers_company_id_voucher_type_voucher_number_key;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_company_id_fy_voucher_type_voucher_number_key
  UNIQUE (company_id, financial_year_id, voucher_type, voucher_number);
