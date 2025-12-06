import mongoose, { Schema, Model, Document } from 'mongoose'

export interface IMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  papers?: any[]
  citationNetwork?: any
}

export interface IChat extends Document {
  projectId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  title: string
  messages: IMessage[]
  depth?: number
  isFavorite?: boolean
  createdAt: Date
  updatedAt: Date
}

const MessageSchema = new Schema<IMessage>({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  papers: {
    type: Schema.Types.Mixed,
    required: false,
  },
  citationNetwork: {
    type: Schema.Types.Mixed,
    required: false,
  },
}, { strict: false })

const ChatSchema = new Schema<IChat>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  messages: {
    type: [MessageSchema],
    default: [],
  },
  depth: {
    type: Number,
    default: 100,
  },
  isFavorite: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
})

ChatSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

const Chat: Model<IChat> = mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema)

export default Chat

