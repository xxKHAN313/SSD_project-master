# Setup Guide — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17

This guide walks you through getting Shield-Chat running on a local development machine from scratch.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Extract / Clone the Project](#2-extract--clone-the-project)
3. [Backend Setup](#3-backend-setup)
4. [Frontend Setup](#4-frontend-setup)
5. [MongoDB Setup](#5-mongodb-setup)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Seed the Database](#7-seed-the-database)
8. [Verify Your Installation](#8-verify-your-installation)
9. [Common Issues and Solutions](#9-common-issues-and-solutions)
10. [Test Credentials](#10-test-credentials)

---

## 1. Prerequisites

Ensure the following are installed before proceeding:

| Requirement | Minimum Version | Check Command           | Download                                   |
|-------------|-----------------|-------------------------|--------------------------------------------|
| Node.js     | 18.0.0          | `node --version`        | https://nodejs.org/                        |
| npm         | 9.0.0           | `npm --version`         | Bundled with Node.js                       |
| MongoDB     | 6.0.0           | `mongod --version`      | https://www.mongodb.com/try/download/community |
| Git         | Any             | `git --version`         | https://git-scm.com/                       |

**Alternatively**, instead of a local MongoDB installation you can use a free [MongoDB Atlas](https://www.mongodb.com/atlas) cloud cluster (see [Section 5.2](#52-mongodb-atlas)).

---

## 2. Extract / Clone the Project

**Option A — Git clone**:
```bash
git clone https://github.com/your-org/shield-chat.git
cd shield-chat
```

**Option B — Extract ZIP**:
```bash
unzip shield-chat.zip
cd shield-chat
```

The project root should contain:
```
shield-chat/
├── backend/
├── frontend/
├── docs/
├── .gitignore
├── CHANGELOG.md
├── README.md
└── SECURITY_OVERVIEW.md
```

---

## 3. Backend Setup

### 3.1 Install Dependencies

```bash
cd backend
npm install
```

This installs all packages listed in `backend/package.json` using the exact versions in `package-lock.json`.

### 3.2 Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in your editor and fill in the required values. See [Section 6](#6-environment-variables-reference) for a complete description of every variable.

At minimum, update:
- `MONGODB_URI` — your MongoDB connection string
- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `JWT_REFRESH_SECRET` — generate separately (different value from JWT_SECRET)
- `ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `EMAIL_HMAC_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3.3 Start the Development Server

```bash
npm run dev
```

Expected output:
```
[Shield-Chat] Server running on port 5000
[Shield-Chat] Connected to MongoDB at mongodb://localhost:27017/shield_chat
[Shield-Chat] Socket.IO server initialized
```

The API is now available at `http://localhost:5000/api`.

### 3.4 Available Backend Scripts

| Script          | Command           | Purpose                                          |
|-----------------|-------------------|--------------------------------------------------|
| Development     | `npm run dev`     | Start with ts-node-dev (auto-restart on change)  |
| Build           | `npm run build`   | Compile TypeScript to `dist/`                    |
| Production      | `npm start`       | Run compiled `dist/app.js`                       |
| Seed            | `npm run seed`    | Populate database with test accounts             |
| Lint            | `npm run lint`    | Run ESLint                                       |
| Test            | `npm test`        | Run Jest test suite                              |

---

## 4. Frontend Setup

Open a **new terminal** (keep the backend running):

### 4.1 Install Dependencies

```bash
cd frontend
npm install
```

### 4.2 Configure Environment Variables

```bash
cp .env.example .env
```

The only required variable for local development is:
```
REACT_APP_API_URL=http://localhost:5000
```

### 4.3 Start the Development Server

```bash
npm start
```

React's development server will start and automatically open `http://localhost:3000` in your browser.

Expected output:
```
Compiled successfully!

You can now view shield-chat in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### 4.4 Available Frontend Scripts

| Script    | Command           | Purpose                                       |
|-----------|-------------------|-----------------------------------------------|
| Start     | `npm start`       | Start development server (hot reload)         |
| Build     | `npm run build`   | Create production build in `build/`           |
| Test      | `npm test`        | Run React Testing Library tests               |
| Lint      | `npm run lint`    | Run ESLint on src/                            |

---

## 5. MongoDB Setup

### 5.1 Local MongoDB

**Start MongoDB** (if installed as a service, it may already be running):

```bash
# macOS / Linux
mongod --dbpath /data/db

# Windows (if not running as a service)
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db"
```

Verify MongoDB is running:
```bash
mongosh --eval "db.runCommand({ connectionStatus: 1 })"
```

The default connection string for local development is:
```
MONGODB_URI=mongodb://localhost:27017/shield_chat
```

MongoDB will create the `shield_chat` database automatically on first use.

### 5.2 MongoDB Atlas (Cloud)

1. Create a free account at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a new **free tier** cluster (M0)
3. In **Database Access**, create a database user with a strong password
4. In **Network Access**, add your current IP address (or `0.0.0.0/0` for development — not recommended for production)
5. Click **Connect** → **Connect your application** → Copy the connection string
6. Replace `<password>` in the connection string with your database user's password
7. Set this as your `MONGODB_URI`:

```
MONGODB_URI=mongodb+srv://shieldchat:<password>@cluster0.xxxxx.mongodb.net/shield_chat?retryWrites=true&w=majority
```

---

## 6. Environment Variables Reference

### Backend (`backend/.env`)

| Variable              | Required | Example Value                                         | Description                                                                                    |
|-----------------------|:--------:|-------------------------------------------------------|------------------------------------------------------------------------------------------------|
| `NODE_ENV`            | YES      | `development`                                         | Application environment. Set to `production` for production deployments.                      |
| `PORT`                | NO       | `5000`                                                | Port the Express server listens on. Defaults to 5000.                                         |
| `MONGODB_URI`         | YES      | `mongodb://localhost:27017/shield_chat`               | Full MongoDB connection string including database name.                                        |
| `JWT_SECRET`          | YES      | *(64+ random hex chars)*                              | Secret for signing JWT access tokens. Generate: `crypto.randomBytes(64).toString('hex')`      |
| `JWT_REFRESH_SECRET`  | YES      | *(64+ random hex chars, different from JWT_SECRET)*   | Secret for signing JWT refresh tokens. Must be different from `JWT_SECRET`.                   |
| `JWT_EXPIRES_IN`      | NO       | `15m`                                                 | Access token lifetime. Default: `15m`. Do not increase beyond 1 hour.                        |
| `JWT_REFRESH_EXPIRES_IN`| NO    | `7d`                                                  | Refresh token lifetime. Default: `7d`.                                                        |
| `ENCRYPTION_KEY`      | YES      | *(64 hex chars = 32 bytes)*                           | AES-256-GCM key for encrypting messages and emails. Generate: `crypto.randomBytes(32).toString('hex')` |
| `EMAIL_HMAC_KEY`      | YES      | *(64 hex chars = 32 bytes)*                           | HMAC-SHA256 key for deterministic email index. Keep separate from ENCRYPTION_KEY.            |
| `BCRYPT_ROUNDS`       | NO       | `12`                                                  | bcrypt cost factor. Default: 12. Increase to 13-14 for higher security on fast hardware.     |
| `FRONTEND_URL`        | YES      | `http://localhost:3000`                               | Allowed CORS origin. Set to your frontend's public URL in production.                        |
| `SMTP_HOST`           | YES*     | `smtp.gmail.com`                                      | SMTP server hostname for sending password reset emails. *Required if email features enabled. |
| `SMTP_PORT`           | YES*     | `587`                                                 | SMTP server port. Typically 587 (STARTTLS) or 465 (SSL).                                    |
| `SMTP_USER`           | YES*     | `noreply@yourdomain.com`                              | SMTP authentication username (email address).                                                 |
| `SMTP_PASS`           | YES*     | *(app password or SMTP password)*                     | SMTP authentication password. Use app-specific passwords for Gmail.                          |
| `SMTP_FROM`           | NO       | `Shield-Chat <noreply@yourdomain.com>`                | Display name and address used in From field of outgoing emails.                               |
| `RATE_LIMIT_WINDOW_MS`| NO       | `900000`                                              | Global rate limit window in milliseconds. Default: 900000 (15 min).                         |
| `RATE_LIMIT_MAX`      | NO       | `100`                                                 | Max requests per window per IP. Default: 100.                                                 |

### Frontend (`frontend/.env`)

| Variable              | Required | Example Value             | Description                                                   |
|-----------------------|:--------:|---------------------------|---------------------------------------------------------------|
| `REACT_APP_API_URL`   | YES      | `http://localhost:5000`   | Base URL of the backend API (no trailing slash).              |
| `REACT_APP_APP_NAME`  | NO       | `Shield-Chat`             | Application name shown in the browser title and UI.           |

**Important**: All React environment variables must be prefixed with `REACT_APP_`. They are embedded in the JavaScript bundle at build time and are therefore public — never put secrets here.

---

## 7. Seed the Database

The seed script creates three test user accounts with predefined credentials:

```bash
cd backend
npm run seed
```

Expected output:
```
[Seed] Connected to MongoDB
[Seed] Cleared existing seed data
[Seed] Created admin user: admin@shield-chat.com
[Seed] Created manager user: manager@shield-chat.com
[Seed] Created employee user: employee@shield-chat.com
[Seed] Created sample chat room: General
[Seed] Added all users to General room
[Seed] Created 5 sample messages
[Seed] Seeding complete!
```

**Test accounts created**:

| Role     | Email                          | Password         |
|----------|--------------------------------|------------------|
| Admin    | admin@shield-chat.com          | Admin@123456     |
| Manager  | manager@shield-chat.com        | Manager@123456   |
| Employee | employee@shield-chat.com       | Employee@123456  |

Re-running the seed script will delete and recreate these accounts. It will not affect any other data.

---

## 8. Verify Your Installation

Work through this checklist to confirm everything is working:

- [ ] Backend starts without errors: `npm run dev` in `backend/` shows "Connected to MongoDB"
- [ ] Frontend starts without errors: `npm start` in `frontend/` opens `http://localhost:3000`
- [ ] Health check responds: `curl http://localhost:5000/api/health` returns `{"status":"ok",...}` (requires admin login)
- [ ] Login works: Log in at `http://localhost:3000` with `employee@shield-chat.com` / `Employee@123456`
- [ ] Chat loads: After login, the room list loads and the General room is visible
- [ ] Real-time works: Open two browser tabs, log in with different accounts, send a message in one tab and see it appear in the other
- [ ] Admin panel works: Log in as `admin@shield-chat.com` and navigate to the Admin panel; user list should be visible
- [ ] Audit log works: As admin, navigate to Audit Logs; login events should be recorded

---

## 9. Common Issues and Solutions

### Issue: `npm install` fails with EACCES permission error

**Cause**: npm does not have permission to write to the global modules directory.

**Solution**:
```bash
# Option A: Use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
npm install

# Option B: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

---

### Issue: `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`

**Cause**: MongoDB is not running.

**Solution**:
```bash
# Start MongoDB (Linux/macOS)
sudo systemctl start mongod
# or
mongod --dbpath /tmp/mongodb-data --fork --logpath /tmp/mongod.log

# Verify it's running
mongosh --eval "db.adminCommand('ping')"
```

---

### Issue: `Error: JWT_SECRET is not defined`

**Cause**: The `.env` file is missing or the variable is not set.

**Solution**:
```bash
cd backend
cp .env.example .env
# Edit .env and set JWT_SECRET to a 64+ character random string
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Issue: Frontend shows "Network Error" on every API call

**Cause**: `REACT_APP_API_URL` is wrong, or the backend is not running.

**Solution**:
1. Confirm the backend is running: `curl http://localhost:5000/api/health`
2. Check `frontend/.env`: `REACT_APP_API_URL=http://localhost:5000` (no trailing slash)
3. Restart the React dev server after editing `.env` (env vars are read at startup)

---

### Issue: CORS error in browser console

**Cause**: `FRONTEND_URL` in the backend `.env` does not match the frontend's origin.

**Solution**:
```bash
# In backend/.env
FRONTEND_URL=http://localhost:3000

# Restart the backend server
```

---

### Issue: `Invalid CSRF token` on form submissions

**Cause**: The browser is not sending the CSRF token in the `X-CSRF-Token` header.

**Solution**: The Axios instance in `frontend/src/api/axios.ts` should automatically read the `XSRF-TOKEN` cookie and attach it. Verify that:
1. The backend sets the `XSRF-TOKEN` cookie on the first request
2. The Axios instance includes `withCredentials: true`
3. The CORS configuration allows the `X-CSRF-Token` request header

---

### Issue: Login succeeds but immediately redirects back to login

**Cause**: The access token is not being stored in memory / AuthContext is resetting.

**Solution**: Open browser DevTools → Network tab → check the `/api/auth/login` response. Confirm:
1. Response includes `accessToken` in the JSON body
2. Response sets a `refreshToken` cookie (check Application → Cookies)
3. No JavaScript errors in the Console tab

---

### Issue: `ENCRYPTION_KEY must be a 64-character hex string` on startup

**Cause**: The `ENCRYPTION_KEY` is incorrect length.

**Solution**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output (64 characters) and set it as ENCRYPTION_KEY in .env
```

---

## 10. Test Credentials

| Role     | Email                          | Password         | Capabilities                                      |
|----------|--------------------------------|------------------|---------------------------------------------------|
| Admin    | admin@shield-chat.com          | Admin@123456     | Full access: user management, all rooms, audit logs |
| Manager  | manager@shield-chat.com        | Manager@123456   | Create rooms, add members, view room messages     |
| Employee | employee@shield-chat.com       | Employee@123456  | Send and read messages in assigned rooms only     |

**Security Warning**: These credentials are for development and local testing only. They are created by the seed script and should never be used in a staging or production environment. Always run `npm run seed` only in your local development environment.
