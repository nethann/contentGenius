# Setup Clerk + Neon PostgreSQL

## 🚀 Quick Setup Guide

### 1. Create Clerk Account
1. Go to [clerk.com](https://clerk.com) and create an account
2. Create a new application
3. Copy the **Publishable Key** from the dashboard

### 2. Create Neon Database
1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Copy the **connection string** from the dashboard

### 3. Update Environment Variables
Copy `.env.example` to `.env` and fill in:

```bash
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# Neon Database  
VITE_NEON_DATABASE_URL=postgresql://username:password@ep-...amazonaws.com/database?sslmode=require
```

### 4. Run Database Migrations
```bash
npm run db:generate
npm run db:migrate
```

### 5. Start the Application
```bash
npm run dev
```

## 🎯 Test the New System

Visit: `http://localhost:5173/clerk-dashboard`

### Features:
- ✅ **Clerk Authentication** - Google OAuth, email/password
- ✅ **Neon PostgreSQL** - Reliable database with auto-scaling
- ✅ **Automatic Tier Assignment** - Your email gets developer tier
- ✅ **Working Pro Upgrades** - Instant tier changes
- ✅ **Proper Sign Out** - Clean logout functionality
- ✅ **Admin Dashboard** - Full admin access for developers

## 📋 Available Scripts

```bash
# Database
npm run db:generate   # Generate migrations
npm run db:migrate    # Run migrations
npm run db:studio     # Open database studio

# Development
npm run dev           # Start dev server
npm run build         # Build for production
```

## 🔧 Troubleshooting

**"Missing Publishable Key" Error:**
- Check that `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env`
- Make sure the key starts with `pk_test_` or `pk_live_`

**Database Connection Issues:**
- Verify `VITE_NEON_DATABASE_URL` is correctly formatted
- Check that your Neon database is active (not hibernating)

**Build Issues:**
- Run `npm install` to ensure all dependencies are installed
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

## 🎉 Benefits of New Stack

**Clerk vs Supabase Auth:**
- More reliable authentication
- Better developer experience  
- Built-in user management UI
- No RLS policy headaches

**Neon vs Supabase Database:**
- Better performance
- Auto-scaling
- More reliable connections
- PostgreSQL-compatible with better tooling

This new setup eliminates all the authentication and database issues you were experiencing!