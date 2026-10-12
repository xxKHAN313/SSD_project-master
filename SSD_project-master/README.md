# Shield-Chat — A Role-Based Secure Messaging Portal

![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED)
![Node](https://img.shields.io/badge/Node.js-20-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

Shield-Chat is a same-origin role-based messaging portal: an Express + Socket.IO API and a React 18 SPA, served from a single hardened Docker image, talking to MongoDB Atlas in the cloud. Messages and emails are AES-256-GCM encrypted at rest, every state-changing action is audit-logged, and every response is shipped behind a strict CSP / HSTS / CSRF stack. The UI is a black-and-white typewriter aesthetic — pure monochrome, JetBrains-Mono-fallback monospace, mechanical key-press button animations.

This README is a top-to-bottom setup guide assuming **nothing** is installed on the machine. Follow the section that matches your situation.

---

## Table of contents

1. [What you are about to install](#1-what-you-are-about-to-install)
2. [Prerequisites — fresh-machine install](#2-prerequisites--fresh-machine-install)
3. [Get the code](#3-get-the-code)
4. [Configure environment variables](#4-configure-environment-variables)
5. [Set up MongoDB Atlas (5 minutes)](#5-set-up-mongodb-atlas-5-minutes)
6. [Run it — Path A: Docker (recommended)](#6-run-it--path-a-docker-recommended)
7. [Run it — Path B: native dev mode (no Docker)](#7-run-it--path-b-native-dev-mode-no-docker)
8. [Optional: Python tools](#8-optional-python-tools-pdf-report--db-dump)
9. [Optional: expose a public URL](#9-optional-expose-a-public-url)
10. [How to stop / restart / rebuild](#10-how-to-stop--restart--rebuild)
11. [Troubleshooting](#11-troubleshooting)
12. [Security & docs](#12-security--docs)

---

## 1. What you are about to install

| Layer            | Component                                          |
|------------------|----------------------------------------------------|
| Database         | MongoDB Atlas (free M0 cluster — cloud)            |
| Backend runtime  | Node 20 (inside the Docker image — or local Node)  |
| Frontend build   | React 18 + CRA (compiled into the same image)      |
| Container        | Docker Desktop + Docker Compose                    |
| Tooling (opt.)   | Python 3 + `reportlab`, `pypdf` (for the security-map PDF and DB dumper) |
| Tunnel (opt.)    | OpenSSH client (built into Windows 10/11) for the serveo / localhost.run tunnel |

The Docker path is the simplest — one image, one `docker compose up -d`, frontend + backend served on the same port (`http://localhost:5000`). The native path is for active development with hot-reload.

---

## 2. Prerequisites — fresh-machine install

### Windows 10 / 11

Open **PowerShell as Administrator** and run:

```powershell
# Install Chocolatey (one-time package manager bootstrap)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Now install everything in one shot
choco install -y git nodejs-lts python docker-desktop
```

After it finishes:
1. **Sign out and back in** (so PATH picks up the new tools).
2. Launch **Docker Desktop** from the Start menu and let it finish first-run setup (it installs WSL 2 if needed and asks to restart). Wait until the Docker whale icon in the system tray says "Docker Desktop is running."

Verify:

```powershell
git --version          # should print git version 2.x
node --version         # v20.x
npm --version          # 10.x
python --version       # Python 3.x
docker --version       # Docker version 27.x or later
docker compose version # v2.x
```

> **No Chocolatey?** Install each manually:
> - Git: <https://git-scm.com/download/win>
> - Node 20 LTS: <https://nodejs.org/>
> - Python 3.11+: <https://www.python.org/downloads/> (tick "Add python.exe to PATH" during install)
> - Docker Desktop: <https://www.docker.com/products/docker-desktop/>

### macOS

```bash
# Install Homebrew if missing
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git node@20 python
brew install --cask docker
open /Applications/Docker.app   # finish first-run setup
```

### Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y git curl python3 python3-pip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # log out + back in for the group to take effect
```

---

## 3. Get the code

```bash
# pick a folder you like
git clone https://github.com/your-org/shield-chat.git
cd shield-chat
```

Or extract the zip you were given and `cd` into it. From here on, every path is relative to the project root (the folder that contains `Dockerfile` and `docker-compose.yml`).

---

## 4. Configure environment variables

The backend refuses to start without a valid `.env` — required secrets are validated at boot.

### Generate the file

```bash
# Windows PowerShell
Copy-Item backend\.env.example backend\.env

# macOS / Linux
cp backend/.env.example backend/.env
```

### Generate strong secrets

The two JWT secrets must be at least **32 characters** and the encryption key must be exactly **64 hex characters** (= 32 bytes for AES-256). Easiest way:

```bash
# any platform — one command, paste each output into the matching slot in .env
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Fill in the `.env`

Open `backend/.env` and edit:

| Key                   | What to put                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `NODE_ENV`            | `production` for the Docker run, `development` for native dev               |
| `PORT`                | `5000` (don't change unless you also change the compose file)               |
| `MONGODB_URI`         | The connection string from Atlas — **see Section 5**                        |
| `JWT_ACCESS_SECRET`   | 96-char hex string from the command above                                   |
| `JWT_REFRESH_SECRET`  | a **different** 96-char hex string                                          |
| `ENCRYPTION_KEY`      | exactly 64 hex chars (32 bytes)                                             |
| `JWT_ACCESS_EXPIRY`   | `1h` (default — leave alone)                                                |
| `JWT_REFRESH_EXPIRY`  | `7d`                                                                        |
| `BCRYPT_ROUNDS`       | `12`                                                                        |
| `EMAIL_*`             | Optional — only used by the password-reset email flow. Skip if you don't need email. |
| `FRONTEND_URL`        | `http://localhost:5000` for Docker (same-origin), or `http://localhost:3000` for native dev |
| `CORS_ORIGINS`        | comma-separated list — at minimum `http://localhost:5000` for Docker, plus `http://localhost:3000` if you also run native dev |
| `RATE_LIMIT_WINDOW_MS`| `60000`                                                                      |
| `RATE_LIMIT_MAX`      | `100`                                                                        |
| `LOG_LEVEL`           | `info`                                                                       |

> **Frontend `.env`:** for the Docker path you don't need one — the SPA is served same-origin and uses relative URLs. For native dev mode, copy `frontend/.env.example` → `frontend/.env` and leave the defaults (`REACT_APP_API_URL=http://localhost:5000/api`).

---

## 5. Set up MongoDB Atlas (5 minutes)

You need a free MongoDB Atlas M0 cluster. Skip this section if you already have one.

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create a free account.
2. Create a project, then create a cluster — pick **M0 / Free**, any region close to you, default settings, **Create Cluster**. Wait ~3 minutes for it to provision.
3. **Database Access** (left sidebar) → **Add New Database User** → choose **Password** auth, give it a username + a strong password, **Built-in Role: Atlas admin** (or `readWrite` on `shield-chat`), **Add User**.
4. **Network Access** → **Add IP Address** → either **Add Current IP Address** (Atlas auto-detects your public IP) or paste `0.0.0.0/0` (allow from anywhere — fine for dev, *not* for production). Confirm.
5. **Database** (left sidebar) → click **Connect** on your cluster → **Drivers** → **Node.js / 5.5+** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` and `<password>` with the credentials from step 3, and append the database name `shield-chat`:
   ```
   mongodb+srv://shieldchat-app:YourPassword@cluster0.xxxxx.mongodb.net/shield-chat?retryWrites=true&w=majority
   ```
7. Paste the result into `MONGODB_URI=` in `backend/.env`.

> **Heads up — Atlas + your home internet:** if you whitelist a specific IP and your ISP later rotates your public IP, the container will boot-loop with `MongooseServerSelectionError: Could not connect to any servers`. You'll see the same error in `docker logs shield-chat`. Two fixes: (a) re-add the new IP in **Network Access**, or (b) just whitelist `0.0.0.0/0` once and never deal with it again (dev only).

---

## 6. Run it — Path A: Docker (recommended)

This is the way to run the app for demo / day-to-day use. One image, one command.

### First-time start

Make sure Docker Desktop is **running** (whale icon in the tray on Windows, menu bar on macOS), then from the project root:

```bash
docker compose up -d --build
```

What happens:
- Stage 1 builds the React SPA (~60s).
- Stage 2 compiles the TypeScript backend (~30s).
- Stage 3 produces a ~60 MB Alpine image with only the production deps and the compiled output.
- Compose creates a container named `shield-chat`, mounts your `backend/.env` for runtime config, and exposes port `5000`.

### Confirm it's healthy

```bash
docker compose ps
# STATUS column should show "Up X seconds (healthy)" within ~30s

curl http://localhost:5000/api/health
# {"success":true,"data":{"status":"ok","database":"connected", ...}}
```

### Open the app

Browser → <http://localhost:5000>

That's it. Same origin serves the SPA, the REST API (`/api/*`), and the Socket.IO endpoint.

### Tail the logs

```bash
docker compose logs -f app
# Ctrl+C to detach (the container keeps running)
```

---

## 7. Run it — Path B: native dev mode (no Docker)

Use this when you're actively coding and want hot-reload. Backend at `:5000`, frontend dev server at `:3000`.

### Backend — Terminal 1

```bash
cd backend
npm install              # ~1–2 min the first time
npm run dev              # ts-node-dev, restarts on file change
```

If you see `[server] Shield-Chat backend listening on http://0.0.0.0:5000` you're good. Health check: <http://localhost:5000/api/health>

### Frontend — Terminal 2

```bash
cd frontend
cp .env.example .env     # or Copy-Item on PowerShell
# (leave the defaults — REACT_APP_API_URL=http://localhost:5000/api)
npm install              # ~2–3 min the first time (CRA deps are large)
npm start                # opens http://localhost:3000 automatically
```

If npm errors out about peer-dep conflicts, run with the legacy resolver:

```bash
npm install --legacy-peer-deps
```

### Why two ports in dev mode?

CRA's dev server lives on `:3000` and proxies `/api` calls to `:5000`. In production (Docker path), the SPA is built and served by Express on `:5000`, so it's all same-origin. The `CORS_ORIGINS` value in `backend/.env` must include `http://localhost:3000` for native dev to work.

---

## 8. Optional: Python tools (PDF report + DB dump)

The repo ships two Python helpers under `tools/`:

| File                            | What it does                                                              |
|---------------------------------|---------------------------------------------------------------------------|
| `tools/build_security_report.py`| Generates `Shield-Chat_Security_Map.pdf` — a 12-page guide to every security file in the codebase |
| `tools/dump_db.ts`              | Connects to Atlas with your `.env` credentials and prints every collection, decrypting the AES-encrypted `email` and `message.content` fields so you can read them |

### Set up Python deps (one-time)

```bash
python -m pip install --upgrade pip
python -m pip install reportlab pypdf
```

### Generate the security-map PDF

```bash
python tools/build_security_report.py
# OK: C:\...\Shield-Chat_Security_Map.pdf  (~32 KB, 12 pages)
```

### Dump the database with decrypted fields

The DB dumper is TypeScript (uses the same crypto utilities the app uses). Run from the backend folder so it picks up `backend/.env`:

```bash
cd backend
npx ts-node ../tools/dump_db.ts
```

You'll see every collection: `users`, `messages`, `sessions`, `auditlogs`, `chatrooms`, `passwordresets` — with `email` and `message.content` decrypted. Sensitive fields (`passwordHash`, `passwordHistory`, `refreshTokenHash`) are redacted.

> Prefer a GUI? Use **MongoDB Compass** (<https://www.mongodb.com/try/download/compass>). Paste your `MONGODB_URI` into the connection string field and connect — same database, friendlier viewer. Encrypted fields will show as `iv:authTag:ciphertext` strings; the dump script is the only way to see them in plaintext.

---

## 9. Optional: expose a public URL

The app listens on localhost. To share it with someone outside your network:

### Easiest — Cloudflare Quick Tunnel

Download `cloudflared.exe` from <https://github.com/cloudflare/cloudflared/releases/latest> (pick `cloudflared-windows-amd64.exe`), drop it somewhere in PATH, then:

```bash
cloudflared tunnel --url http://localhost:5000
# look for: https://<random>.trycloudflare.com
```

The CSP and CORS allow-lists in this project already accept `*.trycloudflare.com`, so the SPA will load and authenticate over the tunnel without any extra configuration.

### Alternative — serveo (no install, just SSH)

```bash
ssh -o ServerAliveInterval=30 -R 80:localhost:5000 serveo.net
# look for: Forwarding HTTP traffic from https://<random>.serveo.net
```

> Serveo is sometimes flaky and may close the connection without printing a URL — re-run the command if that happens. The Docker compose stack has a `--profile tunnel` sidecar that tries to do this in-container, but it has TTY issues; running SSH from your host is more reliable.

---

## 10. How to stop / restart / rebuild

```bash
# stop without removing
docker compose stop

# stop and remove containers (keeps the built image cached)
docker compose down

# restart without rebuild (after editing only .env)
docker compose up -d

# rebuild the image after pulling new code
docker compose build app && docker compose up -d

# follow logs
docker compose logs -f app

# wipe everything and start fresh
docker compose down --rmi local
```

To restart in native dev: `Ctrl+C` in each terminal, then re-run `npm run dev` / `npm start`.

---

## 11. Troubleshooting

| Symptom                                                                 | Likely cause + fix                                                                                                                                                            |
|--------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Container in `Restarting (1)` loop, logs show `MongooseServerSelectionError` | Atlas IP allow-list doesn't include your current public IP. Run `curl https://api.ipify.org` to get it, then add it in Atlas → Network Access. Container heals in ~30s.       |
| `npm ci` / `npm install` fails with `ERESOLVE`                          | CRA peer-dep conflict on Node 20. Use `npm install --legacy-peer-deps`. The Docker build sets this automatically.                                                            |
| Login form does nothing on submit                                       | Hard-refresh the browser (Ctrl+F5 / Cmd+Shift+R). Browsers love to cache the old JS chunks; the new build needs a fresh HTML pull to swap them out.                          |
| `EADDRINUSE: address already in use :::5000`                            | Another process owns the port. Find it with `netstat -ano \| findstr :5000` (Windows) or `lsof -i:5000` (mac/linux), kill it, restart.                                       |
| White page on the LAN IP but localhost works                            | Old CSP issue — make sure you're on the latest build. The current `helmet` config has `useDefaults: false` and does NOT emit `upgrade-insecure-requests`.                    |
| Browser console: `Refused to load script — violates CSP`                | You're running an old build that lacks the per-request nonce. Rebuild and hard-refresh.                                                                                       |
| Logs say `[csrfProtection] Invalid or missing CSRF token` on login       | Login is exempted from CSRF — if you still see this, your client is hitting `/api/auth/login` from a different origin than `CORS_ORIGINS` allows. Add it.                    |
| Docker Desktop won't start                                              | On Windows, ensure WSL 2 is enabled: `wsl --install` then reboot. On macOS, give Docker Desktop full disk access in System Settings → Privacy.                                |
| `docker compose up` hangs at "waiting for service\_healthy"              | Wait up to 30 s for the first start (Atlas connection). If it never goes green, check `docker logs shield-chat` — the failure is logged there in plain English.              |
| Public tunnel URL drops                                                 | Free tunnels (serveo, cloudflared quick) are not permanent. Restart the tunnel command. For something you can leave running, sign up for an ngrok or Cloudflare named tunnel. |

---

## 12. Security & docs

This project takes security posture seriously. Highlights:

- **AES-256-GCM** authenticated encryption for every message body and email at rest.
- **bcrypt** (12 rounds) for password hashing; password history (last 5) prevents reuse.
- **JWT access** (1 h) + **rotating refresh** (7 d) tokens; refresh-token hashes are the only thing stored server-side.
- **Account lockout** after 5 failed attempts (30 min).
- **Rate limiting** tiered per endpoint category, audit-logged on every breach.
- **Helmet CSP** with per-request nonces, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, no `'unsafe-inline'` on scripts.
- **HSTS**, **X-Frame-Options DENY**, **X-Content-Type-Options nosniff**, no `Server` / `X-Powered-By` headers.
- **CSRF** double-submit cookie (`XSRF-TOKEN` ↔ `X-XSRF-TOKEN`) on authenticated state-changing endpoints; pre-session auth endpoints are exempt by design.
- **Input validation** via express-validator, **NoSQL-injection** guard via `express-mongo-sanitize`, **XSS** sanitisation via the `xss` library.
- **Append-only audit log** for every login, role change, message deletion, rate-limit breach, etc.

For the full picture:

| Document                                                              | Description                                       |
|-----------------------------------------------------------------------|---------------------------------------------------|
| [`Shield-Chat_Security_Map.pdf`](Shield-Chat_Security_Map.pdf)        | One-page-per-file map of every security control   |
| [`SECURITY_OVERVIEW.md`](SECURITY_OVERVIEW.md)                        | Executive security summary                        |
| [`docs/SECURITY_DOCUMENTATION.md`](docs/SECURITY_DOCUMENTATION.md)    | Detailed implementation notes                     |
| [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)              | REST + WebSocket reference                        |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                        | System design and data flow                       |
| [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)                | Production deployment + hardening                 |
| [`CHANGELOG.md`](CHANGELOG.md)                                        | Version history                                   |

---

## Roles and permissions (at a glance)

| Capability                  | Employee | Manager | Admin |
|-----------------------------|:--------:|:-------:|:-----:|
| Log in / log out            |    ✓     |    ✓    |   ✓   |
| Send / read / delete-own    |    ✓     |    ✓    |   ✓   |
| Create chat rooms           |    —     |    ✓    |   ✓   |
| Delete any message          |    —     |    —    |   ✓   |
| View / manage all users     |    —     |    —    |   ✓   |
| Change user roles           |    —     |    —    |   ✓   |
| View + export audit log     |    —     |    —    |   ✓   |

---

## Test credentials

If you ran `npm run seed` (from `backend/`), three demo accounts exist:

| Role     | Username     | Password         |
|----------|--------------|------------------|
| Admin    | `admin`      | `Admin@123456`   |
| Manager  | `manager`    | `Manager@123456` |
| Employee | `employee`   | `Employee@123456`|

> **Don't ship these to production.** Rotate them or delete the seed users before exposing the app.

---

## License

MIT — see [`LICENSE`](LICENSE).
