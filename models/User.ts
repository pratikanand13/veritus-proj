import mongoose, { Schema, Model, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface Bookmark {
  paperId: string
  title: string
  tldr?: string
  authors?: string
  keywords: string[]
  bookmarkedAt: Date
}

export interface EmailNotificationHistory {
  sentAt: Date
  papersCount: number
}

export interface IUser extends Document {
  email: string
  password: string
  name: string
  areaOfInterest: string
  isAcademic: boolean
  bookmarks: Bookmark[]
  emailNotificationsEnabled: boolean
  emailNotificationHistory: EmailNotificationHistory[]
  createdAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  areaOfInterest: {
    type: String,
    required: true,
    trim: true,
  },
  isAcademic: {
    type: Boolean,
    required: true,
    default: false,
  },
  bookmarks: {
    type: [
      {
        paperId: { type: String, required: true },
        title: { type: String, required: true },
        tldr: { type: String },
        authors: { type: String },
        keywords: { type: [String], default: [] },
        bookmarkedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
  emailNotificationsEnabled: {
    type: Boolean,
    default: true,
  },
  emailNotificationHistory: {
    type: [
      {
        sentAt: { type: Date, required: true },
        papersCount: { type: Number, default: 0 },
      },
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error: any) {
    next(error)
  }
})

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User

