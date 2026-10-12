# Security Overview — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17
**Classification**: Internal / Project Documentation

This document provides a high-level summary of the security controls implemented in Shield-Chat. For full implementation details, refer to [`docs/SECURITY_DOCUMENTATION.md`](docs/SECURITY_DOCUMENTATION.md).

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Encryption](#2-encryption)
3. [Rate Limiting](#3-rate-limiting)
4. [Input Validation & Sanitization](#4-input-validation--sanitization)
5. [OWASP Top 10 Mitigations](#5-owasp-top-10-mitigations)
6. [Audit Logging](#6-audit-logging)
7. [Session Management](#7-session-management)
8. [Security Headers](#8-security-headers)
9. [Password Policy](#9-password-policy)
10. [Key Management](#10-key-management)

---

## 1. Authentication & Authorization

### JSON Web Tokens (JWT)

Shield-Chat uses a dual-token authentication scheme:

| Token Type    | Storage         | Lifetime    | Purpose                                          |
|---------------|-----------------|-------------|--------------------------------------------------|
| Access Token  | Memory (JS var) | 15 minutes  | Sent as `Authorization: Bearer <token>` header   |
| Refresh Token | HttpOnly Cookie | 7 days      | Used to obtain new access tokens silently        |

Access tokens are short-lived to limit the damage window if intercepted. Refresh tokens are stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies to prevent JavaScript access and CSRF exploitation.

### Role-Based Access Control (RBAC)

Three roles are defined with strictly increasing privilege levels:

| Role     | Level | Capabilities                                                      |
|----------|-------|-------------------------------------------------------------------|
| Employee | 1     | Read and send messages in assigned rooms                          |
| Manager  | 2     | All Employee rights + create rooms, add members, view room logs   |
| Admin    | 3     | Full system access: user management, all rooms, all audit logs    |

Role checks are enforced server-side via the `requireRole(minimumRole)` middleware. The role embedded in the JWT is verified against the user's current role in the database on every sensitive request, preventing stale-token privilege escalation.

### bcrypt Password Hashing

All passwords are hashed using bcrypt with a cost factor of **12** before storage. The cost factor is configurable via `BCRYPT_ROUNDS` environment variable. Plaintext passwords are never logged, stored, or transmitted after the initial hashing operation.

### Account Lockout

To prevent brute-force attacks:

- **Threshold**: 5 consecutive failed login attempts
- **Lockout duration**: 15 minutes (automatic unlock)
- **Manual unlock**: Admins can unlock accounts via the user management API
- **Audit event**: `USER_LOCKED` is written to the audit log on every lockout

---

## 2. Encryption

### Messages at Rest — AES-256-GCM

All message bodies are encrypted before being written to MongoDB:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key size**: 256 bits (32 bytes), derived from `ENCRYPTION_KEY` environment variable
- **IV**: 12-byte random IV generated per encryption operation using `crypto.randomBytes(12)`
- **Auth tag**: 16-byte GCM authentication tag stored with the ciphertext; verified on decryption to detect tampering
- **Storage format**: `iv:authTag:ciphertext` (all hex-encoded) stored in the `body_encrypted` field

If the auth tag verification fails during decryption, the message is rejected and an error is logged — the application never serves potentially tampered ciphertext.

### Email Addresses at Rest — AES-256-GCM

User email addresses are encrypted using the same AES-256-GCM scheme to protect PII at rest. A separate HMAC-SHA256 index field (`email_index`) is stored alongside the encrypted email to enable deterministic equality lookups without decrypting the full dataset.

### Transport Security — TLS 1.3

All HTTP traffic in production is served exclusively over TLS 1.3. The application enforces this via:

- HTTPS-only deployment behind an Nginx reverse proxy (see `docs/DEPLOYMENT_GUIDE.md`)
- `Strict-Transport-Security` header with `max-age=31536000; includeSubDomains; preload`
- HTTP → HTTPS redirect at the Nginx layer; the application itself does not serve plaintext HTTP in production

---

## 3. Rate Limiting

Rate limits are applied per IP address (and per authenticated user where noted) using `express-rate-limit`. All rate-limited endpoints return HTTP **429 Too Many Requests** with a `Retry-After` header.

| Endpoint Group              | Limit                         | Window       | Response Headers                   |
|-----------------------------|-------------------------------|--------------|-------------------------------------|
| Global (all routes)         | 100 requests                  | 15 minutes   | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| `POST /api/auth/login`      | 10 requests per IP            | 15 minutes   | Same as above + `Retry-After`       |
| `POST /api/auth/register`   | 10 requests per IP            | 15 minutes   | Same as above + `Retry-After`       |
| `POST /api/auth/forgot-password` | 10 requests per IP       | 15 minutes   | Same as above + `Retry-After`       |
| `POST /api/auth/reset-password`  | 5 requests per IP        | 60 minutes   | Same as above + `Retry-After`       |
| `POST /api/chat/messages`   | 30 requests per user          | 1 minute     | Same as above + `Retry-After`       |

Rate limit state is stored in-memory by default. For multi-instance deployments, a Redis store should be configured (see `docs/DEPLOYMENT_GUIDE.md`).

---

## 4. Input Validation & Sanitization

Shield-Chat applies a defense-in-depth validation strategy with multiple enforcement layers:

### Layer 1 — Express Validator (Request Boundary)
All incoming request bodies are validated using `express-validator` schemas defined in `backend/src/validators/`. Validation rules include:

- **Email**: Valid RFC 5321 format, normalized to lowercase, trimmed
- **Password**: Minimum 8 characters, must match strength regex (see Section 9)
- **String fields**: Maximum length enforced, trimmed, HTML-escaped
- **ObjectId params**: Validated against MongoDB ObjectId format before hitting the database
- **Body size**: Express `json()` middleware configured with a 10 KB limit; oversized bodies are rejected with HTTP 413

### Layer 2 — Mongoose Schema Validation (Database Boundary)
Mongoose schemas enforce type coercion and required-field constraints as a second line of defense. Enum fields (e.g., role) are validated against allowed values at the schema level.

### Layer 3 — Sanitization
- `xss` library applied to all user-supplied string content before storage
- HTML special characters (`<`, `>`, `"`, `'`, `` ` ``) escaped in API responses
- Mongoose `sanitizeFilter` option enabled to prevent NoSQL injection via `$where` and operator injection in query parameters

---

## 5. OWASP Top 10 Mitigations

| OWASP Category                              | Mitigation Implemented                                                                                   |
|---------------------------------------------|----------------------------------------------------------------------------------------------------------|
| **A01 - Broken Access Control**             | RBAC enforced server-side on every route; JWT role re-validated against database on sensitive operations  |
| **A02 - Cryptographic Failures**            | AES-256-GCM for data at rest; TLS 1.3 in transit; bcrypt for passwords; no MD5/SHA1 for sensitive data   |
| **A03 - Injection**                         | Parameterized Mongoose queries; NoSQL sanitization; `express-validator` input validation                 |
| **A04 - Insecure Design**                   | Threat model documented; least-privilege RBAC; separate access/refresh token lifecycle                   |
| **A05 - Security Misconfiguration**         | Helmet.js security headers; CORS strict origin whitelist; production env vars validated at startup       |
| **A06 - Vulnerable & Outdated Components**  | `npm audit` in CI pipeline; `npm outdated` reviewed before releases; no known high/critical CVEs         |
| **A07 - Identification & Authentication Failures** | bcrypt hashing; account lockout; short-lived JWTs; rotating refresh tokens; secure cookie flags  |
| **A08 - Software & Data Integrity Failures**| GCM auth tags verify message integrity; `npm ci` (lock file) used in CI; subresource integrity on CDN assets |
| **A09 - Security Logging & Monitoring Failures** | Comprehensive audit log for all security events; failed login attempts logged with IP and user agent |
| **A10 - Server-Side Request Forgery (SSRF)**| No outbound HTTP calls to user-supplied URLs; email delivery uses a fixed SMTP server configured via env var |

### SQL / NoSQL Injection

Shield-Chat uses MongoDB exclusively. Injection is prevented by:
1. Using Mongoose model methods (`.find()`, `.findById()`) with typed query objects — user input is never interpolated into query strings
2. Enabling Mongoose's `sanitizeFilter` to strip MongoDB operators (`$where`, `$expr`, etc.) from user-supplied filter objects
3. Validating and casting all ObjectId parameters before use in queries

### Cross-Site Scripting (XSS)

- Server-side: `xss` library sanitizes all stored text content
- Transport: `Content-Security-Policy` header restricts inline scripts and external script sources
- Client-side: React's JSX rendering escapes all interpolated values by default; `dangerouslySetInnerHTML` is not used anywhere in the codebase
- Headers: `X-XSS-Protection: 1; mode=block` for legacy browser compatibility

### Cross-Site Request Forgery (CSRF)

- `csurf` middleware issues a CSRF token on session initialization, required on all state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`)
- Refresh token cookie is `SameSite=Strict`, preventing it from being sent in cross-origin requests
- CORS origin whitelist ensures browsers do not make credentialed cross-origin requests to the API from untrusted origins

### Broken Authentication

- Passwords never stored in plaintext
- Login response never reveals whether the email or password was wrong (generic "Invalid credentials" message)
- Account lockout after 5 failed attempts
- JWT tokens are stateless but short-lived; refresh token rotation ensures compromised refresh tokens can be detected

---

## 6. Audit Logging

All security-relevant events generate an immutable audit log entry. The audit log is **append-only** at the application layer — there are no update or delete routes for audit records.

### Logged Events

| Event Type                   | Trigger                                                  |
|------------------------------|----------------------------------------------------------|
| `USER_REGISTERED`            | New user successfully registers                          |
| `USER_LOGIN`                 | Successful login                                         |
| `USER_LOGIN_FAILED`          | Failed login attempt (wrong password or locked account)  |
| `USER_LOGOUT`                | User logs out and refresh token is invalidated           |
| `USER_LOCKED`                | Account locked after exceeding failed login threshold    |
| `PASSWORD_RESET_REQUESTED`   | Forgot-password email triggered                          |
| `PASSWORD_RESET_COMPLETED`   | Password successfully reset via token                    |
| `ROLE_CHANGED`               | Admin changes a user's role                              |
| `USER_ACTIVATED`             | Admin re-activates a deactivated account                 |
| `USER_DEACTIVATED`           | Admin deactivates an account                             |
| `ROOM_CREATED`               | Manager or admin creates a new chat room                 |
| `MESSAGE_SENT`               | A message is sent in a chat room                         |
| `MESSAGE_DELETED`            | A message is soft-deleted                                |
| `AUDIT_LOG_EXPORTED`         | Admin exports audit logs to CSV                          |

### Log Entry Schema

Each entry contains: `eventType`, `actorId` (user who performed the action), `targetId` (affected user/resource), `ipAddress`, `userAgent`, `timestamp`, `metadata` (event-specific JSON object).

---

## 7. Session Management

| Property             | Configuration                                                     |
|----------------------|-------------------------------------------------------------------|
| Access token lifetime | 15 minutes                                                       |
| Refresh token lifetime | 7 days                                                          |
| Refresh token storage | HttpOnly, Secure, SameSite=Strict cookie                        |
| Token rotation       | New refresh token issued on every use; old token invalidated      |
| Logout               | Refresh token deleted from database; client cookie cleared        |
| Concurrent sessions  | Supported; each device receives its own refresh token            |
| Token invalidation   | All refresh tokens for a user can be revoked via admin action    |

On logout, the refresh token is deleted from the `refresh_tokens` collection. If a previously-issued refresh token is presented after logout (replay attack), the server returns HTTP 401, and a `USER_LOGIN_FAILED` audit event is recorded.

---

## 8. Security Headers

Helmet.js is configured globally on the Express application. The following headers are set on every response:

| Header                        | Value / Configuration                                                                         |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| `Content-Security-Policy`     | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:` |
| `Strict-Transport-Security`   | `max-age=31536000; includeSubDomains; preload`                                                |
| `X-Content-Type-Options`      | `nosniff`                                                                                     |
| `X-Frame-Options`             | `DENY`                                                                                        |
| `X-XSS-Protection`            | `1; mode=block`                                                                               |
| `Referrer-Policy`             | `strict-origin-when-cross-origin`                                                             |
| `Permissions-Policy`          | `camera=(), microphone=(), geolocation=()`                                                    |
| `Cross-Origin-Opener-Policy`  | `same-origin`                                                                                 |
| `Cross-Origin-Resource-Policy`| `same-origin`                                                                                 |

The `X-Powered-By: Express` header is removed to avoid disclosing the server technology stack.

---

## 9. Password Policy

Passwords must satisfy **all** of the following requirements:

| Rule                          | Requirement                         |
|-------------------------------|-------------------------------------|
| Minimum length                | 8 characters                        |
| Maximum length                | 128 characters                      |
| Uppercase letters             | At least 1 required                 |
| Lowercase letters             | At least 1 required                 |
| Digits                        | At least 1 required                 |
| Special characters            | At least 1 required (`!@#$%^&*...`) |
| Common password check         | Rejected if in top-10000 list       |
| Password history              | Cannot reuse last 5 passwords       |
| Bcrypt cost factor            | 12 rounds                           |

Password strength is validated at registration and at password reset. The validation regex is:

```
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,128}$/
```

Error messages always indicate which rule was violated, but never confirm whether an email address exists in the system.

---

## 10. Key Management

### Encryption Key (`ENCRYPTION_KEY`)

- **Format**: 64 hexadecimal characters (32 bytes / 256 bits)
- **Storage**: Environment variable only — never hardcoded, never committed to source control
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Rotation**: Requires re-encrypting all stored ciphertext — a migration script must be run before the old key is retired
- **Access**: Only the backend application process has access to this variable

### JWT Secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)

- **Format**: Minimum 64 random characters (generated via `crypto.randomBytes(64).toString('hex')`)
- **Storage**: Environment variables only
- **Rotation**: Rotating a JWT secret immediately invalidates all outstanding access/refresh tokens, forcing all users to re-authenticate

### Environment Variable Security Checklist

- [ ] `.env` files are listed in `.gitignore` — confirm before every commit
- [ ] Production secrets are set via the hosting platform's secret manager (not `.env` files on disk)
- [ ] Different secrets are used for development, staging, and production environments
- [ ] Secret rotation is documented and tested before production deployment
- [ ] No secrets appear in application logs (`morgan` log format excludes request bodies)
