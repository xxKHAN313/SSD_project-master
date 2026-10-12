# Changelog

All notable changes to Shield-Chat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-17

### Added

#### Authentication & User Management
- User registration with email verification flow and duplicate detection
- Secure login with JWT-based session management (access + refresh token pair)
- Logout endpoint that invalidates refresh tokens server-side
- Token refresh endpoint using rotating refresh tokens
- Forgot-password flow with time-limited, single-use reset tokens sent via email
- Password reset endpoint that validates token expiry and enforces new password policy
- `/api/auth/me` endpoint returning the authenticated user's profile
- Account lockout mechanism: accounts are automatically locked after 5 consecutive failed login attempts for 15 minutes
- Role assignment endpoint (admin-only) to promote or demote users between Employee, Manager, and Admin roles
- User activation and deactivation endpoints (admin-only) to enable or disable accounts without deletion

#### Role-Based Access Control (RBAC)
- Three distinct roles: **Employee**, **Manager**, and **Admin**
- Granular permission matrix enforced at the middleware layer for every protected route
- Employees can send and read messages in rooms they are members of; they cannot create rooms or view audit logs
- Managers can create chat rooms, add members, and view limited audit logs for their rooms
- Admins have full system access including user management, all audit logs, and system health endpoints
- Role guard middleware (`requireRole`) applied to all sensitive routes, returning 403 on insufficient privilege

#### Real-Time Messaging
- Chat room creation with name, description, and member list (managers and admins)
- Room listing endpoint returning only rooms the authenticated user is a member of
- Message listing with pagination support (page and limit query parameters)
- Send message endpoint with end-to-end AES-256-GCM encryption stored at rest
- Message deletion (soft delete) for admins and the original message author
- WebSocket server via Socket.IO for real-time message delivery
- WebSocket events: `join-room`, `leave-room`, `send-message`, `receive-message`, `typing`, `stop-typing`, `user-joined`, `user-left`, `error`
- Typing indicator broadcast to all room members except the sender
- Room membership enforcement on WebSocket join: users cannot subscribe to rooms they are not members of

#### Encryption & Data Protection
- AES-256-GCM symmetric encryption for all message bodies stored in MongoDB
- AES-256-GCM encryption for user email addresses stored in MongoDB (searchable via deterministic HMAC index)
- Per-record random 12-byte IV generated for every encryption operation
- Auth tag stored alongside ciphertext to ensure integrity verification on decryption
- bcrypt password hashing with configurable cost factor (default: 12 rounds)
- Encrypted fields transparently decrypted by Mongoose virtual getters/setters

#### Audit Logging
- Immutable audit log collection capturing every security-relevant event
- Logged events include: `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGIN_FAILED`, `USER_LOGOUT`, `USER_LOCKED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `ROLE_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ROOM_CREATED`, `MESSAGE_SENT`, `MESSAGE_DELETED`, `AUDIT_LOG_EXPORTED`
- Each log entry records: event type, actor user ID, target user/resource ID, IP address, user agent, timestamp, and a metadata object for additional context
- Audit log listing endpoint with filtering by event type, date range, and actor (admin-only)
- Audit log CSV export endpoint (admin-only) for compliance reporting

#### Rate Limiting
- Global rate limiter: 100 requests per 15-minute window per IP
- Authentication endpoints: 10 requests per 15-minute window per IP (login, register, forgot-password)
- Password reset endpoint: 5 requests per hour per IP
- Message send endpoint: 30 messages per minute per authenticated user
- All rate limit responses include `Retry-After` and `X-RateLimit-*` headers

#### Input Validation & Sanitization
- Request body validation using `express-validator` on all POST/PUT endpoints
- Mongoose schema-level validation as a secondary enforcement layer
- HTML tag stripping and special character escaping on all user-supplied string fields
- Strict email format validation with normalization (lowercase, trim)
- Password strength enforcement: minimum 8 characters, at least one uppercase letter, one lowercase letter, one digit, and one special character
- ObjectId format validation on all URL parameters that reference database documents
- JSON body size limit set to 10 KB to prevent oversized payload attacks

#### Security Headers & Transport Security
- Helmet.js integration setting the following headers on every response:
  - `Content-Security-Policy` restricting script and resource sources
  - `Strict-Transport-Security` (HSTS) with a 1-year max-age and `includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` disabling camera, microphone, and geolocation
- CORS configured to accept requests only from the explicitly whitelisted frontend origin
- CSRF protection via `csurf` middleware on all state-mutating endpoints
- Cookie flags: `HttpOnly`, `Secure` (production), `SameSite=Strict` on refresh token cookies

#### API & Backend Infrastructure
- Express.js REST API with structured routing under `/api/v1`
- MongoDB with Mongoose ODM; six core models: User, ChatRoom, Message, AuditLog, RefreshToken, PasswordResetToken
- Socket.IO WebSocket server co-hosted on the same Express HTTP server
- Centralized error handling middleware with generic client-facing messages (no stack traces in production)
- Health check endpoint at `/api/health` returning service status and uptime
- Database connection retry logic with exponential back-off on startup

#### Frontend Application
- React 18 single-page application bootstrapped with Create React App (TypeScript template)
- React Router v6 for client-side routing with protected route guards
- Context API + custom hooks for authentication state (`useAuth`) and role checking (`useRole`)
- Axios HTTP client with request interceptor for automatic JWT attachment and response interceptor for token refresh
- Real-time chat interface with Socket.IO client, typing indicators, and auto-scroll to latest message
- Role-aware UI: admin panel, user management table, and audit log viewer rendered conditionally based on user role
- Toast notifications for success/error feedback on all async actions
- Responsive layout supporting desktop and tablet viewports

### Security

- Passwords stored exclusively as bcrypt hashes (cost factor 12); plaintext passwords are never logged or persisted
- All inter-service communication enforced over TLS 1.3 in production
- JWT access tokens expire after 15 minutes; refresh tokens expire after 7 days and are rotated on every use
- Refresh tokens are stored as bcrypt hashes in the database; the raw token is only ever returned to the client once
- Account lockout prevents brute-force attacks on the login endpoint
- Rate limiting on authentication routes adds an additional layer against credential stuffing
- Message encryption keys derived from the server-side `ENCRYPTION_KEY` environment variable (32-byte hex); this variable must never be committed to source control
- Audit logs are append-only at the application layer; no update or delete routes exist for audit records
- All error responses return generic messages to avoid information leakage; detailed errors are written only to server-side logs
- Dependency audit via `npm audit` run as part of the CI pipeline; known high/critical vulnerabilities block merges

### Technical Details

- **Runtime**: Node.js 18 LTS
- **Language**: TypeScript 5 (strict mode enabled) for both frontend and backend
- **Database**: MongoDB 6 with Mongoose 7
- **Authentication**: JSON Web Tokens (`jsonwebtoken` library), bcrypt (`bcryptjs`)
- **Encryption**: Node.js built-in `crypto` module, AES-256-GCM mode
- **WebSockets**: Socket.IO 4
- **Validation**: `express-validator` 7
- **Rate Limiting**: `express-rate-limit` 7
- **Security Headers**: `helmet` 7
- **CORS**: `cors` middleware with explicit origin whitelist
- **Frontend**: React 18, TypeScript, React Router 6, Axios, Socket.IO Client

---

## [Unreleased]

### Planned
- End-to-end encryption with client-side key generation (Signal Protocol or similar)
- Multi-factor authentication (TOTP via authenticator app)
- File attachment support with virus scanning
- Message search with encrypted index
- Email notification preferences per user
- OAuth 2.0 / SSO integration (Google, Microsoft)
- Kubernetes deployment manifests
- Automated penetration testing integration in CI/CD pipeline
