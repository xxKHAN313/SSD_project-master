# Security Documentation — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17

This document describes the detailed implementation of every security control in Shield-Chat. It is intended for developers, security reviewers, and auditors who need to understand the internals of the security architecture.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Password Security](#2-password-security)
3. [Message Encryption](#3-message-encryption)
4. [Database Security](#4-database-security)
5. [Rate Limiting Configuration](#5-rate-limiting-configuration)
6. [CORS Configuration](#6-cors-configuration)
7. [CSRF Protection](#7-csrf-protection)
8. [Security Headers](#8-security-headers)
9. [RBAC Permission Matrix](#9-rbac-permission-matrix)
10. [Audit Logging](#10-audit-logging)
11. [Session Management](#11-session-management)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Known Security Trade-offs and Mitigations](#13-known-security-trade-offs-and-mitigations)

---

## 1. Authentication Flow

### 1.1 Registration Flow

```
Client                          Backend                          Database
  |                               |                                |
  |-- POST /api/auth/register --> |                                |
  |   { name, email, password }   |                                |
  |                               |-- Validate input (validator) -->|
  |                               |-- Check email uniqueness ------>|
  |                               |<-- User not found --------------|
  |                               |-- Hash password (bcrypt 12) ----|
  |                               |-- Encrypt email (AES-256-GCM) ->|
  |                               |-- Create User document -------->|
  |                               |<-- User saved ------------------|
  |                               |-- Write USER_REGISTERED audit ->|
  |<-- 201 { message: "..." } ----|                                |
```

Key steps:
1. Input validated by `express-validator` schema (`registerValidator`)
2. Email uniqueness checked via HMAC index lookup (not plaintext search)
3. Password hashed with `bcryptjs.hash(password, 12)`
4. Email encrypted with AES-256-GCM before storage
5. `USER_REGISTERED` audit event written with IP and user agent
6. No JWT issued at registration — user must log in separately

### 1.2 Login Flow

```
Client                          Backend                          Database
  |                               |                                |
  |-- POST /api/auth/login -----> |                                |
  |   { email, password }         |                                |
  |                               |-- Look up user by email index ->|
  |                               |<-- User document ---------------|
  |                               |-- Check account active -------->|
  |                               |-- Check lockout status -------->|
  |                               |-- bcrypt.compare(pw, hash) ---->|
  |                               |   [FAIL] increment failedLogins |
  |                               |   [FAIL] lock if >= 5 -------->|
  |                               |   [FAIL] write FAILED audit --->|
  |                               |   [SUCCESS] reset failedLogins ->|
  |                               |-- Sign access JWT (15min) ------|
  |                               |-- Sign refresh JWT (7d) ------->|
  |                               |-- Hash & store refresh token -->|
  |                               |-- Write USER_LOGIN audit ------>|
  |<-- 200 { accessToken, user } -|                                |
  |    Set-Cookie: refreshToken   |                                |
```

### 1.3 JWT Lifecycle

**Access Token**:
- Algorithm: `HS256`
- Payload: `{ sub: userId, role: userRole, iat, exp }`
- Expiry: 900 seconds (15 minutes)
- Secret: `JWT_SECRET` environment variable (minimum 64 random characters)
- Sent as: `Authorization: Bearer <token>` header on every authenticated request

**Refresh Token**:
- Algorithm: `HS256`
- Payload: `{ sub: userId, jti: uuidv4(), iat, exp }`
- Expiry: 604800 seconds (7 days)
- Secret: `JWT_REFRESH_SECRET` environment variable (separate from access token secret)
- Sent as: `HttpOnly; Secure; SameSite=Strict` cookie named `refreshToken`
- Stored: bcrypt hash in `refresh_tokens` collection alongside `userId` and `expiresAt`

### 1.4 Token Refresh Flow

```
Client                          Backend                          Database
  |                               |                                |
  |-- POST /api/auth/refresh ----> |                                |
  |   Cookie: refreshToken=<t>    |                                |
  |                               |-- Verify JWT signature -------->|
  |                               |-- Look up token hash in DB ---->|
  |                               |<-- Token record found ----------|
  |                               |-- Check not expired ----------->|
  |                               |-- Delete old token record ----->|
  |                               |-- Issue new access token ------>|
  |                               |-- Issue new refresh token ----->|
  |                               |-- Store new refresh token hash->|
  |<-- 200 { accessToken } -------|                                |
  |    Set-Cookie: new refreshToken                                |
```

If a refresh token that has already been used is presented (replay attack), the token lookup will fail (it was deleted), and HTTP 401 is returned. A `USER_LOGIN_FAILED` audit event is written.

### 1.5 Logout Flow

1. Client sends `POST /api/auth/logout` with the refresh token cookie
2. Backend verifies the refresh token JWT signature
3. The corresponding `RefreshToken` document is deleted from the database
4. The `refreshToken` cookie is cleared (expired, HttpOnly, Secure)
5. `USER_LOGOUT` audit event is written
6. Access tokens cannot be actively invalidated (they expire naturally within 15 minutes); clients must discard the token from memory

---

## 2. Password Security

### 2.1 Hashing Implementation

```typescript
// Hashing (registration / password reset)
const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
const hash = await bcrypt.hash(plainTextPassword, saltRounds);

// Verification (login)
const isMatch = await bcrypt.compare(plainTextPassword, storedHash);
```

bcrypt's built-in salt generation ensures that identical passwords produce different hashes. The cost factor of 12 results in approximately 200–400 ms per hash operation on modern hardware — deliberately slow to impede offline dictionary attacks.

### 2.2 Password Strength Requirements

| Rule                  | Requirement                                           |
|-----------------------|-------------------------------------------------------|
| Minimum length        | 8 characters                                          |
| Maximum length        | 128 characters (prevents DoS via long bcrypt input)   |
| Uppercase             | At least 1 character (A–Z)                            |
| Lowercase             | At least 1 character (a–z)                            |
| Digit                 | At least 1 character (0–9)                            |
| Special character     | At least 1 from `!@#$%^&*()_+-=[]{};':"\|,.<>/?`     |
| Common password check | Rejected if found in top-10,000 common password list  |

Validation regex applied in `registerValidator` and `resetPasswordValidator`:

```
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,128}$/
```

### 2.3 Password History

The `User` model stores the last 5 password hashes in a `passwordHistory` array. On password reset, the new password is compared against each stored hash using `bcrypt.compare`. If any comparison returns true, the reset is rejected with a 400 error.

### 2.4 Password Reset Flow

1. User submits `POST /api/auth/forgot-password` with their email
2. Backend looks up the user by email HMAC index
3. A cryptographically random 32-byte token is generated: `crypto.randomBytes(32).toString('hex')`
4. SHA-256 hash of the token is stored in the `password_reset_tokens` collection with a 1-hour expiry
5. The raw token is embedded in a reset link and emailed to the user
6. User clicks the link and submits `POST /api/auth/reset-password` with the raw token and new password
7. Backend hashes the submitted token with SHA-256 and looks it up in the database
8. Token is validated: must exist, not expired, not already used
9. New password is validated against strength rules and password history
10. Password is hashed and saved; the reset token document is deleted
11. All active refresh tokens for the user are deleted (forces re-login on all devices)
12. `PASSWORD_RESET_COMPLETED` audit event is written

The response to step 2 is always `200 OK` with the message "If that email exists, a reset link has been sent" — regardless of whether the email was found. This prevents email enumeration.

---

## 3. Message Encryption

### 3.1 AES-256-GCM Implementation

AES-256-GCM (Galois/Counter Mode) provides both confidentiality and integrity (authenticated encryption). It is implemented using Node.js's built-in `crypto` module.

**Encryption**:

```typescript
import { createCipheriv, randomBytes } from 'crypto';

function encryptMessage(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
  const iv = randomBytes(12);                                   // 96-bit IV
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag(); // 16-byte GCM auth tag

  // Storage format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

**Decryption**:

```typescript
import { createDecipheriv } from 'crypto';

function decryptMessage(stored: string): string {
  const [ivHex, authTagHex, ciphertext] = stored.split(':');
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8'); // Throws if auth tag verification fails

  return decrypted;
}
```

If the auth tag does not match (ciphertext was tampered with), `decipher.final()` throws an `Error: Unsupported state or unable to authenticate data`. This exception is caught by the global error handler, logged server-side, and the client receives a generic 500 error.

### 3.2 Key Management

The encryption key is a 256-bit (32-byte) secret loaded from the `ENCRYPTION_KEY` environment variable:

```
ENCRYPTION_KEY=a3f1c2d4e5b6a7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

Generate a new key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The key is loaded once at application startup and never re-read from the environment during runtime. It is never logged, included in error messages, or returned in any API response.

### 3.3 Email Encryption and Indexing

Email addresses are PII and are encrypted at rest. However, emails must be searchable for authentication. The solution uses a deterministic HMAC-SHA256 index:

```typescript
import { createHmac } from 'crypto';

function hashEmail(email: string): string {
  return createHmac('sha256', process.env.EMAIL_HMAC_KEY!)
    .update(email.toLowerCase().trim())
    .digest('hex');
}
```

The `User` model stores:
- `email_encrypted`: AES-256-GCM encrypted email (used for display only)
- `email_index`: HMAC-SHA256 of the normalized email (used for lookups and uniqueness checks)

Lookups compute the HMAC of the query email and compare against `email_index`. This means an attacker with database read access cannot recover email addresses without also knowing `EMAIL_HMAC_KEY`.

---

## 4. Database Security

### 4.1 Encrypted Fields in Mongoose

Encrypted fields are handled transparently via Mongoose virtual setters and getters:

```typescript
UserSchema.virtual('email')
  .get(function () { return decryptEmail(this.email_encrypted); })
  .set(function (value: string) {
    this.email_encrypted = encryptEmail(value);
    this.email_index = hashEmail(value);
  });
```

Application code works with plain `user.email`; encryption/decryption is invisible at the model layer.

### 4.2 Connection Security

```typescript
mongoose.connect(process.env.MONGODB_URI!, {
  ssl: process.env.NODE_ENV === 'production',
  tls: process.env.NODE_ENV === 'production',
  authSource: 'admin',
});
```

In production, the MongoDB connection string must use `mongodb+srv://` (Atlas) or include TLS parameters for self-hosted deployments.

### 4.3 NoSQL Injection Prevention

```typescript
mongoose.set('sanitizeFilter', true);
```

This Mongoose option strips any keys beginning with `$` from query filters, preventing injection via operator overloading in user-controlled query parameters.

---

## 5. Rate Limiting Configuration

Implemented with `express-rate-limit`. All limiters use the same store instance (in-memory by default; Redis recommended for multi-instance deployments).

```typescript
// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
});

// Password reset limiter (strictest)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
});

// Message send limiter (per user, not per IP)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.user!.id, // keyed by authenticated user ID
});
```

| Endpoint                         | Limiter       | Max Requests | Window    |
|----------------------------------|---------------|--------------|-----------|
| All routes                       | globalLimiter | 100          | 15 min    |
| POST /api/auth/login             | authLimiter   | 10           | 15 min    |
| POST /api/auth/register          | authLimiter   | 10           | 15 min    |
| POST /api/auth/forgot-password   | authLimiter   | 10           | 15 min    |
| POST /api/auth/reset-password    | resetLimiter  | 5            | 60 min    |
| POST /api/chat/rooms/:id/messages| messageLimiter| 30           | 1 min     |

---

## 6. CORS Configuration

```typescript
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [process.env.FRONTEND_URL!];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,              // Allow cookies (refresh token)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,                  // Preflight cache: 24 hours
};

app.use(cors(corsOptions));
```

`credentials: true` is required to allow the browser to send the `HttpOnly` refresh token cookie on cross-origin requests to the API. The `origin` whitelist ensures only the official frontend origin can make credentialed requests.

---

## 7. CSRF Protection

`csurf` middleware is applied to all state-mutating routes. The CSRF token is returned to the client in a non-HttpOnly cookie (`XSRF-TOKEN`) that JavaScript can read, and the client must echo it back in the `X-CSRF-Token` request header.

```typescript
import csurf from 'csurf';

const csrfProtection = csurf({
  cookie: {
    httpOnly: false,   // Must be readable by JS to set the header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

// Applied to all state-mutating routes
router.post('/login', csrfProtection, authLimiter, loginValidator, loginController);
router.post('/register', csrfProtection, authLimiter, registerValidator, registerController);
```

The `SameSite=Strict` attribute on the refresh token cookie additionally ensures it is not transmitted on cross-origin navigations, making CSRF exploitation significantly harder even without the CSRF token.

---

## 8. Security Headers

Helmet.js is initialized with a custom configuration:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.disable('x-powered-by');
```

| Header                       | Value                                              | Purpose                                              |
|------------------------------|----------------------------------------------------|------------------------------------------------------|
| `Content-Security-Policy`    | Restricts sources per directive                    | Prevents XSS by blocking unauthorized script sources |
| `Strict-Transport-Security`  | `max-age=31536000; includeSubDomains; preload`     | Forces HTTPS for 1 year across all subdomains        |
| `X-Content-Type-Options`     | `nosniff`                                          | Prevents MIME-type sniffing attacks                  |
| `X-Frame-Options`            | `DENY`                                             | Prevents clickjacking via iframe embedding           |
| `X-XSS-Protection`           | `1; mode=block`                                    | Legacy XSS filter for older browsers                 |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                  | Limits referrer information sent to third parties    |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=()`         | Disables sensitive browser APIs                      |
| `Cross-Origin-Opener-Policy` | `same-origin`                                      | Isolates browsing context to prevent Spectre attacks |
| `X-Powered-By`               | _(removed)_                                        | Hides Express.js version fingerprint                 |

---

## 9. RBAC Permission Matrix

Role hierarchy: `Employee (1) < Manager (2) < Admin (3)`

The `requireRole(minimumRole)` middleware extracts the role from the verified JWT, re-validates it against the database (to catch role downgrades mid-session), and rejects with HTTP 403 if the user's role is below the required level.

| Feature / Endpoint                              | Employee | Manager | Admin |
|-------------------------------------------------|:--------:|:-------:|:-----:|
| POST /api/auth/register                         | Public   | Public  | Public|
| POST /api/auth/login                            | Public   | Public  | Public|
| POST /api/auth/logout                           | YES      | YES     | YES   |
| POST /api/auth/refresh                          | YES      | YES     | YES   |
| GET  /api/auth/me                               | YES      | YES     | YES   |
| POST /api/auth/forgot-password                  | Public   | Public  | Public|
| POST /api/auth/reset-password                   | Public   | Public  | Public|
| GET  /api/users                                 | NO       | NO      | YES   |
| GET  /api/users/:id                             | NO       | NO      | YES   |
| PUT  /api/users/:id/role                        | NO       | NO      | YES   |
| PUT  /api/users/:id/activate                    | NO       | NO      | YES   |
| PUT  /api/users/:id/deactivate                  | NO       | NO      | YES   |
| GET  /api/chat/rooms                            | YES      | YES     | YES   |
| POST /api/chat/rooms                            | NO       | YES     | YES   |
| GET  /api/chat/rooms/:id                        | Member   | Member  | YES   |
| GET  /api/chat/rooms/:id/messages               | Member   | Member  | YES   |
| POST /api/chat/rooms/:id/messages               | Member   | Member  | YES   |
| DELETE /api/chat/rooms/:id/messages/:msgId      | Own only | Own only| YES   |
| GET  /api/audit                                 | NO       | NO      | YES   |
| GET  /api/audit/export                          | NO       | NO      | YES   |
| GET  /api/health                                | NO       | NO      | YES   |

"Member" means the user must be a member of that specific room, enforced by a separate room-membership middleware that runs after role verification.

---

## 10. Audit Logging

### 10.1 AuditLog Schema

```typescript
const AuditLogSchema = new Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'USER_REGISTERED', 'USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_LOGOUT',
      'USER_LOCKED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
      'ROLE_CHANGED', 'USER_ACTIVATED', 'USER_DEACTIVATED',
      'ROOM_CREATED', 'MESSAGE_SENT', 'MESSAGE_DELETED', 'AUDIT_LOG_EXPORTED',
    ],
  },
  actorId:   { type: Schema.Types.ObjectId, ref: 'User', required: false },
  targetId:  { type: Schema.Types.ObjectId, required: false },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  metadata:  { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, immutable: true },
}, {
  collection: 'audit_logs',
});

// Index for efficient querying
AuditLogSchema.index({ eventType: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
```

### 10.2 Logging Helper

```typescript
async function writeAuditLog(params: {
  eventType: AuditEventType;
  actorId?: string;
  targetId?: string;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditLog.create(params);
}
```

### 10.3 Event-Specific Metadata

| Event Type             | Metadata Fields                                      |
|------------------------|------------------------------------------------------|
| `USER_LOGIN_FAILED`    | `{ email_index, reason: 'wrong_password' | 'locked' }` |
| `ROLE_CHANGED`         | `{ fromRole, toRole, targetUserId }`                 |
| `MESSAGE_DELETED`      | `{ roomId, messageId, reason }`                      |
| `AUDIT_LOG_EXPORTED`   | `{ filterApplied, recordCount, format: 'csv' }`      |

---

## 11. Session Management

Access tokens are stored exclusively in JavaScript memory (a React context variable). They are never written to `localStorage` or `sessionStorage` to prevent XSS-based token theft.

Refresh tokens are stored in `HttpOnly` cookies, making them inaccessible to JavaScript. The browser automatically sends them on requests to the same origin.

On application load, the frontend immediately calls `POST /api/auth/refresh` to obtain a fresh access token. If the refresh token is expired or missing, the user is redirected to the login page.

Token refresh is handled transparently by the Axios response interceptor:
1. If a request returns 401, the interceptor queues the original request
2. It calls `POST /api/auth/refresh`
3. On success, it retries all queued requests with the new access token
4. On failure (refresh token expired), it clears the auth context and redirects to `/login`

---

## 12. Error Handling Strategy

All errors flow through the centralized `errorHandler` middleware registered at the end of the Express middleware chain.

```typescript
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Log full error server-side
  logger.error({ err, url: req.url, method: req.method, ip: req.ip });

  // Send generic message to client in production
  res.status(err.statusCode || 500).json({
    error: isDev ? err.message : 'An unexpected error occurred.',
    ...(isDev && { stack: err.stack }),
  });
}
```

Key principles:
- **No stack traces** sent to clients in production
- **Generic 500 messages** for unhandled errors (no internal details)
- **Specific 4xx messages** for validation errors (these are safe to expose: they tell the user what input was wrong, not server internals)
- **No field-level database errors** exposed (e.g., a MongoDB duplicate key error is mapped to a 409 with a generic conflict message)
- **Authentication errors** always return the same message ("Invalid credentials") regardless of whether the email was not found or the password was wrong

---

## 13. Known Security Trade-offs and Mitigations

| Trade-off                                                     | Risk Level | Mitigation                                                               |
|---------------------------------------------------------------|:----------:|--------------------------------------------------------------------------|
| JWT access tokens cannot be actively revoked                  | Medium     | Short 15-minute expiry limits the blast radius; refresh token revocation handles long-term sessions |
| AES key rotation requires message re-encryption migration     | Low        | Key rotation script documented in DEPLOYMENT_GUIDE; old and new keys used simultaneously during migration window |
| In-memory rate limit state lost on process restart            | Low        | Acceptable for single-instance dev; Redis store required for production multi-instance deployments |
| bcrypt max input length is 72 bytes                           | Low        | Maximum password length enforced at 128 characters; passwords are truncated by bcrypt at 72 bytes — users creating passwords longer than 72 bytes are warned in the UI |
| CSRF token stored in a non-HttpOnly cookie (readable by JS)   | Low        | Required by design (JS must read it to set the header); mitigated by SameSite=Strict on the refresh token cookie |
| Email HMAC index leaks email existence if attacker has `EMAIL_HMAC_KEY` | Low | HMAC key stored only as an environment variable; treated with same secrecy as encryption key |
| No end-to-end encryption (server decrypts messages)           | Medium     | Server-side encryption at rest prevents database-level breaches; true E2E is planned for v2.0 |
