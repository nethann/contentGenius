# Database Management Server Commands

## Step 1: Start the Server
```bash
# Double-click run-db-server.bat or run:
node db-server.js
```

## Step 2: Test Commands (copy and paste in new terminal)

### Test if server is running:
```bash
curl http://localhost:3002/test
```

### Check database status:
```bash
curl http://localhost:3002/check-database
```

### Set up database (run this first!):
```bash
curl -X POST http://localhost:3002/setup-database
```

### Create your Pro profile (REPLACE WITH YOUR INFO):
```bash
curl -X POST http://localhost:3002/create-profile \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"c2e903e3-aff3-43a2-9a99-97d18882e5e8\",\"email\":\"nethan.nagendran@gmail.com\",\"tier\":\"pro\"}"
```

### Check your profile was created:
```bash
curl http://localhost:3002/profile/c2e903e3-aff3-43a2-9a99-97d18882e5e8
```

### Update tier to developer:
```bash
curl -X POST http://localhost:3002/update-tier \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"c2e903e3-aff3-43a2-9a99-97d18882e5e8\",\"tier\":\"developer\"}"
```

## PowerShell Commands (if curl doesn't work):

### Test server:
```powershell
Invoke-RestMethod -Uri "http://localhost:3002/test"
```

### Setup database:
```powershell
Invoke-RestMethod -Uri "http://localhost:3002/setup-database" -Method POST
```

### Create profile:
```powershell
$body = @{
    user_id = "c2e903e3-aff3-43a2-9a99-97d18882e5e8"
    email = "nethan.nagendran@gmail.com"
    tier = "pro"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3002/create-profile" -Method POST -Body $body -ContentType "application/json"
```

## What This Does:
1. **Sets up your database** with proper tables and permissions
2. **Creates your user profile** with Pro tier automatically
3. **Tests everything** to make sure it works
4. **Gives you full control** over user management

## After Setup:
- Your React app should work properly
- Pro upgrade should work
- Admin dashboard should load
- Sign out should work

Run these commands in order:
1. Start server (run-db-server.bat)
2. Setup database
3. Create your profile
4. Test your React app!