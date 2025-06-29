
# Languella - AI Language Learning Platform

A full-stack language learning application with AI chat, vocabulary management, and practice tools.

## Deployment Instructions

### 1. Supabase Setup
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/mkxiedycngmaizgkkheo
2. Navigate to SQL Editor
3. Copy and paste the entire content from `supabase-schema.sql`
4. Execute the SQL to create all tables and policies

### 2. Environment Variables
The following environment variables are already configured in `.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `FRONTEND_URL`
- `DATABASE_URL`

### 3. Deploy on Replit
1. Click the "Deploy" button in the top right
2. Select "Autoscale Deployment" (recommended) or "Reserved VM"
3. The deployment will automatically:
   - Install dependencies
   - Start the server on port 5000
   - Initialize database connections

### 4. Post-Deployment
- Your app will be available at: `https://languella.onrender.com/`
- Test authentication by creating a new account
- Verify database connectivity in the browser console

## Features
- 🔐 Complete authentication system (signup, login, password reset)
- 💬 AI-powered language learning chat
- 📚 Vocabulary management with spaced repetition
- 🎯 Practice modes (flashcards, cloze tests, quizzes)
- 📊 Progress tracking and achievements
- 🌙 Dark mode support
- 📱 Mobile-responsive design

## Tech Stack
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth
- AI: OpenRouter API
- Frontend: Vanilla JS (no framework)
- Deployment: Replit Deployments
