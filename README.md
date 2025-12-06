# Academic Dashboard Application

A Next.js application with JWT authentication, academic email validation, and a ChatGPT-like dashboard for managing projects and chats.

## Features

- 🔐 JWT-based authentication with 7-day session for academic users
- 🎓 Academic email validation (IIT, NIT, IIIT domains)
- 📁 Project and chat management
- 💬 Chat interface similar to ChatGPT
- 📊 Analytical tree structure stored in file system
- 🌙 Dark theme UI
- 📱 Responsive design

## Prerequisites

- Node.js 18+ 
- MongoDB instance (local or cloud)
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/academic-dashboard
   JWT_SECRET=your-secret-key-change-in-production
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app
  /api          - API routes (auth, projects, chats)
  /(auth)       - Authentication pages (login, signup)
  /dashboard    - Dashboard pages
  /components   - React components
/lib            - Utility functions
/models         - MongoDB models
/types          - TypeScript types
/analytics      - File system storage for analytical tree
```

## Usage

1. **Sign Up:** Use an academic email address (IIT, NIT, IIIT domains)
2. **Create Projects:** Organize your work into projects
3. **Create Chats:** Add chats within projects
4. **Start Chatting:** Use the chat interface to interact

## Academic Email Domains

The application validates emails against a list of academic domains including:
- IITs (Indian Institutes of Technology)
- NITs (National Institutes of Technology)
- IIITs (Indian Institutes of Information Technology)

Only users with academic email addresses can sign up.

## Technologies Used

- Next.js 14 (App Router)
- TypeScript
- MongoDB with Mongoose
- JWT for authentication
- Tailwind CSS
- shadcn/ui components
- Lucide React icons

## License

MIT

