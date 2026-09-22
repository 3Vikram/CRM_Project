import { Router } from 'express'
import { LoginSchema } from '@crm/shared'
import { database } from '../db.js'
import { AccountingError } from '../accounting/errors.js'
import { verifyPassword } from './password.js'
import { findUserByEmail, findUserById, toPublicUser, touchLastLogin } from './users.js'
import { issueAccessToken, requireActor } from './token.js'
import { isRateLimited, recordFailedAttempt, clearAttempts } from './rateLimit.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body)
    const rateLimitKey = `${input.email.toLowerCase()}:${req.ip}`
    if (isRateLimited(rateLimitKey)) throw new AccountingError('Too many login attempts. Try again later.', 429, 'RATE_LIMITED')

    const pool = database()
    const user = await findUserByEmail(pool, input.email)
    const valid = user ? await verifyPassword(input.password, user.password_hash) : false
    if (!user || !user.active || !valid) {
      recordFailedAttempt(rateLimitKey)
      throw new AccountingError('Invalid email or password', 401, 'INVALID_CREDENTIALS')
    }

    clearAttempts(rateLimitKey)
    await touchLastLogin(pool, user.id)
    const secret = process.env.ACCOUNTING_AUTH_SECRET
    if (!secret) throw new AccountingError('Server is not configured for login', 500, 'SERVER_MISCONFIGURED')
    const { token } = issueAccessToken({ id: user.id, role: user.role }, secret)
    res.json({ token, user: toPublicUser(user) })
  } catch (error) { next(error) }
})

authRouter.get('/me', requireActor, async (req, res, next) => {
  try {
    const user = await findUserById(database(), req.actor!.id)
    if (!user) throw new AccountingError('User not found', 404, 'NOT_FOUND')
    res.json(toPublicUser(user))
  } catch (error) { next(error) }
})
