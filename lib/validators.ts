import { z } from 'zod'
import { isAcademicEmail } from './academic-domains'

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  areaOfInterest: z.string().min(1, 'Area of interest is required'),
}).refine((data) => {
  return isAcademicEmail(data.email)
}, {
  message: 'Only academic email addresses are allowed for signup',
  path: ['email'],
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

