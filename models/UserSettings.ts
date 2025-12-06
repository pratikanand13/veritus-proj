import mongoose, { Schema, Model, Document } from 'mongoose'

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId
  veritusApiKey?: string
  searchPreferences?: {
    defaultFieldsOfStudy?: string[]
    defaultLimit?: number
    defaultEnrich?: boolean
  }
  createdAt: Date
  updatedAt: Date
}

const UserSettingsSchema = new Schema<IUserSettings>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  veritusApiKey: {
    type: String,
    trim: true,
  },
  searchPreferences: {
    defaultFieldsOfStudy: [String],
    defaultLimit: {
      type: Number,
      default: 100,
    },
    defaultEnrich: {
      type: Boolean,
      default: false,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

UserSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

const UserSettings: Model<IUserSettings> = mongoose.models.UserSettings || mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema)

export default UserSettings

