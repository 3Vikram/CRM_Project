import { z } from 'zod'
import { accountingRoles } from './accounting-roles.js'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type Login = z.infer<typeof LoginSchema>

export const UserRoleSchema = z.enum(accountingRoles)

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  active: z.boolean(),
})
export type User = z.infer<typeof UserSchema>

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
})
export type AuthResponse = z.infer<typeof AuthResponseSchema>
