# Zii - Social Prediction Platform

## Overview
Zii is a prediction/betting platform where users can predict outcomes on real daily events (drama, music, trends, relationships, nightlife) and win real money.

## Architecture

### Backend
- **Framework**: Express.js with PostgreSQL database
- **Authentication**: Custom JWT-based authentication (migrated from Firebase Auth)
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Server Port**: 3001 (development)

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI**: Tailwind CSS (via CDN in development)
- **Port**: 5000 (with proxy to backend)

### API Structure
- `/api/auth/*` - Authentication endpoints (login, register, profile, delete-account)
- `/api/predictions/*` - Prediction CRUD and resolution
- `/api/entries/*` - User entries/bets
- `/api/wallet/*` - Balance, transactions, voucher redemption, cashout
- `/api/admin/*` - Admin dashboard endpoints
- `/api/affiliates/*` - Partner referral system
- `/api/creator-invites/*` - Creator invite system
- `/api/settings` - Platform settings

### Key Files
- `server.js` - Express server entry point
- `server/api.js` - API route definitions
- `server/db.js` - PostgreSQL connection and schema
- `server/auth.js` - JWT authentication helpers
- `utils/api.ts` - Frontend API client
- `contexts/AuthContext.tsx` - React auth context

## Recent Changes (December 2024)

### Firebase to PostgreSQL Migration
- Removed all Firebase/Firestore dependencies from frontend
- Migrated AuthContext to use custom JWT authentication
- Updated all pages to use backend API client
- Added Vite proxy configuration for development
- Added new API endpoints: /auth/profile, /auth/delete-account, /affiliates/validate

### Two-Server Development Setup
- Vite dev server on port 5000 (frontend + proxy)
- Express API server on port 3001 (backend)
- API requests proxied from /api/* to backend

## User Preferences
- Dark theme with cyan accent color (#2DD4BF)
- Mobile-first responsive design
- Gamification with levels and XP
- Multi-country support (ZW, ZA, NG, etc.)

## Running the App
- Backend: `node server.js` (port 3001)
- Frontend: `npm run dev` (port 5000)
- Both must run simultaneously for full functionality
