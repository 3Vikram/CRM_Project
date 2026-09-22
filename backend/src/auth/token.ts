import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { accountingRoles, type AccountingRole } from '@crm/shared'
import { AccountingError } from '../accounting/errors.js'

export { accountingRoles }
export type { AccountingRole }
export type Actor = { id: string; role: AccountingRole }
export type TokenPayload = Actor & { exp: number }

const TOKEN_TTL_SECONDS = 8 * 60 * 60 // 8 hours

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

export function signAccessToken(payload: TokenPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`
}

/** Convenience for login: signs a fresh token for `actor` that expires in TOKEN_TTL_SECONDS. */
export function issueAccessToken(actor: Actor, secret: string) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  return { token: signAccessToken({ ...actor, exp }, secret), exp }
}

// Kept for the pre-login callers/tests that referenced the old name.
export const signAccountingAccessToken = signAccessToken

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
