export const PHONE_ERROR_MESSAGE = 'Please enter a valid 10-digit phone number.'
export const sanitizePhoneInput = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 10)
export const isValidPhoneNumber = (value?: string | null) => /^\d{10}$/.test(String(value ?? '').trim())
