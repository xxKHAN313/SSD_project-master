# Shield Chat

**Role-based messaging prototype**

A full-stack messaging prototype with role-based rooms, real-time events, authentication, audit logging, and server-side encryption of stored messages.

TypeScript · React · Express · Socket.IO · MongoDB · Docker

> Academic prototype. Features below are grounded in the source; validation limits are recorded below.

## What it does

- React interface backed by an Express API and Socket.IO events.
- Admin, manager, and employee roles with room access rules.
- JWT-based authentication and bcrypt password hashing.
- AES-256-GCM utilities for stored message and email fields.
- Audit logging and middleware for validation, rate limiting, and HTTP headers.

## Getting started

Commands below use Windows PowerShell.

```powershell
git clone https://github.com/xxKHAN313/SSD_project-master.git
cd SSD_project-master/SSD_project-master
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
# Configure backend/.env before starting the application.
cd backend
npm ci
npm run dev
```

The supplied Dockerfile uses Node 20. A reachable MongoDB database is required. Set `MONGODB_URI`, independent JWT secrets of at least 32 characters, and `ENCRYPTION_KEY` to 64 random hexadecimal characters. Configure development origins for ports 3000 and 5000. Never commit the populated `.env` files.

In a second terminal, enter `SSD_project-master/frontend`, run `npm ci --legacy-peer-deps`, then `npm start`. The frontend runs on port 3000 and the API on port 5000. Docker Compose is also included, but requires a database reachable from its container.

The backend seed script creates fixed demonstration accounts and logs their credentials. Use it only with an isolated disposable database. Encryption is performed by the server; this project does not implement end-to-end encryption.

## Code map

`backend/src` — API, authentication, models, services, and socket handling; `frontend/src` — React interface; `docs` — design documentation; `Dockerfile` and `docker-compose.yml` — container configuration.

Browse the [application source](SSD_project-master/).

## Validation and limitations

Package scripts and encryption implementation were inspected. Builds, database integration, and security properties have not been independently validated. Backend compilation: `npm run build` in `backend`; frontend compilation: `npm run build` in `frontend`.

## Credits and license

This repository contains academic work. Existing source credits and acknowledgements are retained; individual contributions should be confirmed before attributing the whole project to one person.

No standalone license file was found in the reviewed checkout. Existing notices remain in effect; no new license is asserted here.
