import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { AccountingError } from './errors.js'

export const accountingRoles = ['administrator', 'accountant', 'maker', 'approver', 'auditor', 'read_only_management', 'migration_operator'] as const
export type AccountingRole = typeof accountingRoles[number]
export type Actor = { id: string; role: AccountingRole }
type TokenPayload = Actor & { exp: number }

declare global { namespace Express { interface Request { actor?: Actor } } }

function decodeAccessToken(token: string): Actor | undefined {
  const secret = process.env.ACCOUNTING_AUTH_SECRET
  if (!secret) return undefined
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return undefined
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url')
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return undefined
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload
    if (!payload.id || !accountingRoles.includes(payload.role) || payload.exp * 1000 <= Date.now()) return undefined
    return { id: payload.id, role: payload.role }
  } catch { return undefined }
}

export function signAccountingAccessToken(payload: TokenPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`
}

export function requireActor(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.header('authorization')
  const actor = authorization?.startsWith('Bearer ') ? decodeAccessToken(authorization.slice(7)) : undefined
  if (!actor) return next(new AccountingError('Authentication is required', 401, 'UNAUTHENTICATED'))
  req.actor = actor
  next()
}

export function allow(...roles: AccountingRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role)) return next(new AccountingError('You are not authorized for this operation', 403, 'FORBIDDEN'))
    next()
  }
}
