export class AccountingError extends Error {
  constructor(message: string, public status = 400, public code = 'ACCOUNTING_ERROR') { super(message) }
}

export class NotFoundError extends AccountingError {
  constructor(message: string) { super(message, 404, 'NOT_FOUND') }
}

export class ConflictError extends AccountingError {
  constructor(message: string) { super(message, 409, 'CONFLICT') }
}
