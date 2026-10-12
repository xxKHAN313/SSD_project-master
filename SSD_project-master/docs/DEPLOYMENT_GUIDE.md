# Deployment Guide — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17

This guide covers deploying Shield-Chat to a production environment securely and reliably.

---

## Table of Contents

1. [Production Environment Overview](#1-production-environment-overview)
2. [Production Environment Variables](#2-production-environment-variables)
3. [MongoDB Atlas Setup](#3-mongodb-atlas-setup)
4. [Building for Production](#4-building-for-production)
5. [Docker Deployment](#5-docker-deployment)
6. [HTTPS / TLS Setup](#6-https--tls-setup)
7. [Nginx Reverse Proxy Configuration](#7-nginx-reverse-proxy-configuration)
8. [Health Check Setup](#8-health-check-setup)
9. [Monitoring and Logging](#9-monitoring-and-logging)
10. [Backup Strategy](#10-backup-strategy)
11. [Security Hardening Checklist](#11-security-hardening-checklist)

---

## 1. Production Environment Overview

The recommended production architecture:

```
Internet
    │
    ▼
[ Cloudflare / DNS ]
    │  (DDoS protection, CDN for static assets)
    ▼
[ Nginx (443/HTTPS) ]
    ├── /           → Serve React build from /var/www/shield-chat/build/
    └── /api, /socket.io → Proxy to Node.js app on 127.0.0.1:5000
    │
    ▼
[ Node.js / Express (port 5000, internal only) ]
    │
    ▼
[ MongoDB Atlas (cloud) ]
    or
[ Self-hosted MongoDB with TLS (port 27017, firewall-restricted) ]
```

**Minimum server specifications** for a small team (up to 50 concurrent users):
- vCPU: 2 cores
- RAM: 2 GB
- Disk: 20 GB SSD
- OS: Ubuntu 22.04 LTS or Debian 12

---

## 2. Production Environment Variables

**Critical security rules**:
- NEVER commit `.env` files to version control
- Use your hosting platform's secret management (e.g., AWS Secrets Manager, Railway env vars, Render environment)
- Use DIFFERENT secrets for production than development
- Rotate secrets if they are ever accidentally exposed

### Backend Production `.env`

```bash
# ============================================================
# PRODUCTION ENVIRONMENT — KEEP THESE SECRETS CONFIDENTIAL
# ============================================================

NODE_ENV=production
PORT=5000

# MongoDB — Use Atlas connection string with TLS
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/shield_chat_prod?retryWrites=true&w=majority

# JWT Secrets — Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# MUST be at least 64 random characters. NEVER reuse development secrets.
JWT_SECRET=<64+ character random hex string>
JWT_REFRESH_SECRET=<64+ character random hex string — DIFFERENT from JWT_SECRET>

# Token lifetimes
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption — Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Store this key safely — losing it means all stored messages become unreadable.
ENCRYPTION_KEY=<64 hex characters = 32 bytes>
EMAIL_HMAC_KEY=<64 hex characters = 32 bytes — DIFFERENT from ENCRYPTION_KEY>

# bcrypt — Increase to 13 or 14 for production hardware
BCRYPT_ROUNDS=12

# Frontend URL — Exact origin, no trailing slash
FRONTEND_URL=https://shield-chat.yourdomain.com

# SMTP — Use a transactional email service (SendGrid, Postmark, AWS SES)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<SendGrid API key or SMTP password>
SMTP_FROM=Shield-Chat <noreply@yourdomain.com>

# Rate limiting (these are the defaults; tune based on observed traffic)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### Frontend Production `.env`

```bash
# This is embedded in the JavaScript bundle — DO NOT put secrets here
REACT_APP_API_URL=https://shield-chat.yourdomain.com
REACT_APP_APP_NAME=Shield-Chat
```

---

## 3. MongoDB Atlas Setup

### 3.1 Create a Production Cluster

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new project: "shield-chat-production"
3. Build a cluster — select **M10** or higher for production (M0 free tier is not suitable for production workloads)
4. Choose your preferred cloud provider (AWS, GCP, or Azure) and region closest to your server

### 3.2 Secure the Cluster

**Network Access**:
1. Go to Security → Network Access
2. Add only your application server's static IP address
3. Do NOT add `0.0.0.0/0` in production

**Database Access**:
1. Go to Security → Database Access
2. Create a new user with username `shieldchat_app`
3. Assign the **readWrite** role on the `shield_chat_prod` database only
4. Use a strong password (32+ random characters)

**Encryption at Rest**:
- Enabled by default on M10+ clusters
- Optionally enable **Bring Your Own Key (BYOK)** with AWS KMS for regulatory compliance

### 3.3 Get the Connection String

1. Click **Connect** on your cluster
2. Choose **Connect your application**
3. Select **Node.js**, version **4.1 or later**
4. Copy the connection string and replace `<password>` with your database user's password
5. Set this as `MONGODB_URI` in your production environment

---

## 4. Building for Production

### 4.1 Build the Backend

```bash
cd backend
npm ci                   # Install exact versions from package-lock.json
npm run build            # Compiles TypeScript to dist/
```

Output: `backend/dist/` containing compiled JavaScript.

Start the production server:
```bash
NODE_ENV=production node dist/app.js
```

Or use **PM2** for process management:
```bash
npm install -g pm2

# Start with PM2
pm2 start dist/app.js --name shield-chat-backend --env production

# Auto-start on system reboot
pm2 startup
pm2 save
```

### 4.2 Build the Frontend

```bash
cd frontend
npm ci
npm run build
```

Output: `frontend/build/` — a static file directory ready to be served by Nginx.

Copy to the web root:
```bash
sudo cp -r frontend/build/ /var/www/shield-chat/
```

---

## 5. Docker Deployment

### 5.1 Backend Dockerfile

`backend/Dockerfile`:
```dockerfile
# ---- Build Stage ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -S shieldchat && adduser -S shieldchat -G shieldchat

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER shieldchat

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/app.js"]
```

### 5.2 Frontend Dockerfile

`frontend/Dockerfile`:
```dockerfile
# ---- Build Stage ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---- Production Stage (Nginx) ----
FROM nginx:1.25-alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

`frontend/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # React Router — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
}
```

### 5.3 Docker Compose

`docker-compose.yml`:
```yaml
version: '3.9'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: shield-chat-backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"    # Bind to localhost only — Nginx proxies to this
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=production
    depends_on:
      - mongo
    networks:
      - shield-chat-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=https://shield-chat.yourdomain.com
    container_name: shield-chat-frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:80"     # Nginx (host) proxies to this
    networks:
      - shield-chat-network

  mongo:
    image: mongo:6.0
    container_name: shield-chat-mongo
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
      - MONGO_INITDB_DATABASE=shield_chat_prod
    networks:
      - shield-chat-network
    # Do NOT expose port 27017 to the host

volumes:
  mongo-data:
    driver: local

networks:
  shield-chat-network:
    driver: bridge
```

**Start**:
```bash
docker compose up -d
docker compose logs -f
```

**Stop**:
```bash
docker compose down
```

---

## 6. HTTPS / TLS Setup

### Using Certbot (Let's Encrypt) with Nginx

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d shield-chat.yourdomain.com

# Certbot auto-renews — verify the renewal timer is active
sudo systemctl status certbot.timer
```

Certbot will automatically modify your Nginx configuration to enable HTTPS and redirect HTTP to HTTPS.

**Renewal**: Certificates expire every 90 days. Certbot installs a systemd timer that renews automatically. Test it:
```bash
sudo certbot renew --dry-run
```

---

## 7. Nginx Reverse Proxy Configuration

`/etc/nginx/sites-available/shield-chat`:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name shield-chat.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name shield-chat.yourdomain.com;

    # TLS certificates (managed by Certbot)
    ssl_certificate     /etc/letsencrypt/live/shield-chat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shield-chat.yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers (supplement the ones set by Express/Helmet)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend — serve React build
    root /var/www/shield-chat/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location /static/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # WebSocket proxy (Socket.IO)
    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;   # Keep WebSocket connections alive for 1 hour
    }

    # Block access to sensitive files
    location ~ /\. {
        deny all;
    }

    # Limit upload size
    client_max_body_size 10m;

    # Logging
    access_log /var/log/nginx/shield-chat-access.log;
    error_log  /var/log/nginx/shield-chat-error.log warn;
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/shield-chat /etc/nginx/sites-enabled/
sudo nginx -t         # Test configuration syntax
sudo systemctl reload nginx
```

---

## 8. Health Check Setup

### Application Health Endpoint

`GET /api/health` returns:
```json
{
  "status": "ok",
  "uptime": 86400,
  "timestamp": "2026-04-17T10:00:00.000Z",
  "services": {
    "database": "connected",
    "server": "running"
  }
}
```

### PM2 Health Monitoring

```bash
pm2 monit             # Interactive process monitor
pm2 status            # Process list with CPU/memory
pm2 logs              # Tail all application logs
```

### Uptime Monitoring

Set up an external uptime monitor (e.g., UptimeRobot, Better Uptime) to ping `https://shield-chat.yourdomain.com/api/health` every 5 minutes and alert on downtime.

### Systemd Service (alternative to PM2)

`/etc/systemd/system/shield-chat.service`:
```ini
[Unit]
Description=Shield-Chat Backend
After=network.target mongod.service

[Service]
Type=simple
User=shieldchat
WorkingDirectory=/opt/shield-chat/backend
ExecStart=/usr/bin/node dist/app.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=/opt/shield-chat/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable shield-chat
sudo systemctl start shield-chat
sudo systemctl status shield-chat
```

---

## 9. Monitoring and Logging

### Application Logs

Production logs are written by Winston to:
- `logs/combined.log` — all log levels
- `logs/error.log` — error level only
- Console (stdout) — info and above

Log format (JSON in production):
```json
{
  "level": "error",
  "message": "Failed to decrypt message",
  "messageId": "64c3d4e5f6a7b8c9d0e1f2a3",
  "timestamp": "2026-04-17T10:05:00.000Z"
}
```

### Log Rotation

Install `logrotate` configuration:

`/etc/logrotate.d/shield-chat`:
```
/opt/shield-chat/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
```

### Centralized Logging (Optional)

For production teams, ship logs to a centralized platform:

**Option A — Datadog**:
```bash
npm install --save datadog-winston
```

**Option B — AWS CloudWatch**:
Use the CloudWatch agent to ship `/logs/combined.log` to a CloudWatch log group.

**Option C — Papertrail / Logtail**:
Configure rsyslog or the Papertrail agent to forward application logs.

### Metrics to Monitor

| Metric                    | Alert Threshold         |
|---------------------------|-------------------------|
| API response time (p99)   | > 2000 ms               |
| Failed login rate         | > 20 per minute         |
| HTTP 5xx error rate       | > 1% of requests        |
| MongoDB connection errors | Any                     |
| Disk usage                | > 80%                   |
| Memory usage              | > 80%                   |
| PM2 process restarts      | > 3 in 10 minutes       |

---

## 10. Backup Strategy

### MongoDB Atlas Backups

MongoDB Atlas M10+ clusters include:
- **Continuous backup** with point-in-time recovery (PITR) up to 7 days
- **Daily snapshots** retained for up to 1 month
- Enable in Cluster → Backup tab

### Self-Hosted MongoDB Backup

Set up a daily backup cron job:

```bash
# /opt/scripts/backup-mongodb.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/backups/mongodb/$DATE"
mkdir -p "$BACKUP_DIR"

mongodump \
  --uri="mongodb://shieldchat_app:<password>@localhost:27017/shield_chat_prod" \
  --out="$BACKUP_DIR" \
  --gzip

# Remove backups older than 30 days
find /backups/mongodb -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
```

```bash
# Add to crontab (runs at 2:00 AM daily)
crontab -e
0 2 * * * /opt/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

Ship backups to off-site storage (AWS S3, Backblaze B2):
```bash
aws s3 sync /backups/mongodb/ s3://your-backup-bucket/mongodb/ --storage-class STANDARD_IA
```

### Encryption Key Backup

The `ENCRYPTION_KEY` is critically important — losing it means all stored messages become permanently unreadable. Back it up securely:
1. Store it in a hardware security module (HSM) or a secrets manager (AWS Secrets Manager, HashiCorp Vault)
2. Print and store a paper copy in a physically secure location (safe or safety deposit box)
3. Test key recovery before going to production

---

## 11. Security Hardening Checklist

Complete this checklist before accepting production traffic:

### Application Security
- [ ] `NODE_ENV=production` is set — disables stack traces in error responses
- [ ] All JWT secrets are 64+ random characters and different from development values
- [ ] `ENCRYPTION_KEY` is 32 random bytes (64 hex chars) and backed up securely
- [ ] All `.env` files are owned by the application user with permissions `600` (`chmod 600 .env`)
- [ ] `npm audit` shows no high or critical vulnerabilities
- [ ] `npm ci` is used in deployment (not `npm install`) to enforce lock file

### Server Security
- [ ] Firewall: only ports 22 (SSH), 80 (HTTP→redirect), and 443 (HTTPS) are open to the internet
- [ ] MongoDB port 27017 is NOT accessible from the internet (firewall block or bind to localhost)
- [ ] SSH is configured with key-based authentication only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ] Unattended security updates are enabled: `sudo apt install unattended-upgrades`
- [ ] The application runs as a non-root user (`shieldchat` or similar)
- [ ] `/proc/sys/kernel/dmesg_restrict` is set to `1` (prevents non-root users reading kernel log)

### TLS / HTTPS
- [ ] HTTPS is enforced — HTTP requests redirect to HTTPS at the Nginx layer
- [ ] TLS certificate is valid and auto-renewal is confirmed working (`certbot renew --dry-run`)
- [ ] TLS 1.0 and 1.1 are disabled in Nginx (`ssl_protocols TLSv1.2 TLSv1.3;`)
- [ ] HSTS is configured with `max-age=31536000; includeSubDomains; preload`
- [ ] SSL Labs test scores A or A+: [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)

### Database Security
- [ ] MongoDB root user is disabled in production (only use application-specific user)
- [ ] Database user has minimal permissions (readWrite on one database only)
- [ ] MongoDB is NOT exposed to the internet (VPC / private network or localhost only)
- [ ] TLS is enabled for MongoDB connections in production (`ssl=true` in connection string)
- [ ] Automated backups are configured and tested

### Monitoring & Response
- [ ] Uptime monitoring is configured and alerts on downtime
- [ ] Log rotation is configured
- [ ] Failed login alert is configured (> 20 per minute triggers notification)
- [ ] An incident response runbook exists (who to contact, steps to take if compromised)
- [ ] Security contact email is documented (`security@yourdomain.com`)

### Post-Deployment Verification
- [ ] Log in with all three test roles and verify correct access control
- [ ] Verify HTTPS redirect: `curl -I http://shield-chat.yourdomain.com` → 301 redirect
- [ ] Verify security headers: `curl -I https://shield-chat.yourdomain.com/api/health` → HSTS, CSP, etc.
- [ ] Verify WebSocket works: send a real-time message between two browser sessions
- [ ] Verify audit logs are being written (check after login/logout)
- [ ] Verify rate limiting: 10+ rapid login attempts trigger 429 response
- [ ] Remove seed data if the seed script was run: `npm run seed:clean`
