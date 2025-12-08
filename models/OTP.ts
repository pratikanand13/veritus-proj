import mongoose, { Schema, Model, Document } from 'mongoose'

export interface IOTP extends Document {
  email: string
  otp: string
  expiresAt: Date
  verified: boolean
  createdAt: Date
}

const OTPSchema = new Schema<IOTP>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // Auto-delete expired OTPs
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Index for faster lookups
OTPSchema.index({ email: 1, verified: 1 })

const OTP: Model<IOTP> = mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema)

export default OTP

