export interface User {
  _id: string
  email: string
  name: string
  areaOfInterest: string
  isAcademic: boolean
  createdAt: Date
}

export interface Project {
  _id: string
  userId: string
  name: string
  description?: string
  createdAt: Date
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Chat {
  _id: string
  projectId: string
  userId: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

