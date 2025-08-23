@echo off
echo 🚀 Starting Database Management Server...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install express cors @supabase/supabase-js
    echo.
)

echo 🌟 Running Database Management Server...
echo 📡 Server will be available at: http://localhost:3002
echo.
echo Available endpoints:
echo   GET  /test              - Test if server is running
echo   GET  /check-database    - Check database status
echo   POST /setup-database    - Set up database tables
echo   POST /create-profile    - Create user profile
echo   POST /update-tier       - Update user tier
echo.

node db-server.cjs

pause