export const accountingRoles = [
  'administrator', 'accountant', 'maker', 'approver', 'auditor', 'read_only_management', 'migration_operator',
] as const
export type AccountingRole = typeof accountingRoles[number]
