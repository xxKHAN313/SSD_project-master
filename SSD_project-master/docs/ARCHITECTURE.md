# Architecture — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Component Breakdown](#2-component-breakdown)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Database Schema Overview](#4-database-schema-overview)
5. [Security Architecture Layers](#5-security-architecture-layers)
6. [RBAC Design](#6-rbac-design)
7. [Encryption Architecture](#7-encryption-architecture)
8. [API Design Principles](#8-api-design-principles)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CLIENT TIER                                  │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────────┐ │
│   │               React SPA (Browser)                                  │ │
│   │                                                                    │ │
│   │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│   │  │  Auth Pages │  │  Chat UI     │  │  Admin Panel             │  │ │
│   │  │  Login      │  │  Room List   │  │  User Management         │  │ │
│   │  │  Register   │  │  Message Feed│  │  Audit Log Viewer        │  │ │
│   │  │  Reset PW   │  │  Typing Ind. │  │  Role Assignment         │  │ │
│   │  └─────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│   │                                                                    │ │
│   │  ┌────────────┐  ┌───────────────┐  ┌────────────────────────┐    │ │
│   │  │ AuthContext│  │ Socket Context│  │ Axios Instance          │    │ │
│   │  │ useAuth    │  │ Socket.IO     │  │ + JWT interceptor        │    │ │
│   │  │ useRole    │  │ Client        │  │ + Refresh interceptor    │    │ │
│   │  └────────────┘  └───────────────┘  └────────────────────────┘    │ │
│   └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────┬────────────────────────────┘
                           │ HTTPS / REST      │ WSS / WebSocket
                           │                   │
┌──────────────────────────▼──────────────────▼────────────────────────────┐
│                            SERVER TIER                                   │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────────┐ │
│   │                    Nginx (Reverse Proxy)                           │ │
│   │         TLS Termination │ HTTP→HTTPS Redirect │ Static Files      │ │
│   └───────────────────────────────┬────────────────────────────────────┘ │
│                                   │                                      │
│   ┌───────────────────────────────▼────────────────────────────────────┐ │
│   │                   Express.js Application                           │ │
│   │                                                                    │ │
│   │  ┌──────────────────────────────────────────────────────────────┐  │ │
│   │  │                   Middleware Pipeline                        │  │ │
│   │  │  Helmet → CORS → Rate Limiter → CSRF → JSON Parser →        │  │ │
│   │  │  Auth Middleware → Role Guard → Request Validator            │  │ │
│   │  └──────────────────────────────────────────────────────────────┘  │ │
│   │                                                                    │ │
│   │  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────┐  ┌────────┐   │ │
│   │  │ Auth     │  │ Users    │  │ Chat   │  │ Audit │  │ Health │   │ │
│   │  │ Router   │  │ Router   │  │ Router │  │ Router│  │ Router │   │ │
│   │  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬───┘  └────────┘   │ │
│   │       │              │            │            │                   │ │
│   │  ┌────▼──────────────▼────────────▼────────────▼─────────────┐    │ │
│   │  │               Controller Layer                             │    │ │
│   │  │  authController │ userController │ chatController │ ...    │    │ │
│   │  └─────────────────────────┬───────────────────────────────────┘   │ │
│   │                             │                                      │ │
│   │  ┌──────────────────────────▼───────────────────────────────────┐  │ │
│   │  │                    Service Layer                             │  │ │
│   │  │  encryptionService │ auditService │ emailService │ tokenService│ │ │
│   │  └──────────────────────────────────────────────────────────────┘  │ │
│   │                                                                    │ │
│   │  ┌──────────────────────────────────────────────────────────────┐  │ │
│   │  │            Socket.IO Server (co-hosted)                      │  │ │
│   │  │       JWT Auth → Room Guard → Message Handlers               │  │ │
│   │  └──────────────────────────────────────────────────────────────┘  │ │
│   └───────────────────────────────┬────────────────────────────────────┘ │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                            DATA TIER                                     │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────────┐ │
│   │                     MongoDB (via Mongoose)                         │ │
│   │                                                                    │ │
│   │   users │ chat_rooms │ messages │ audit_logs │ refresh_tokens │    │ │
│   │   password_reset_tokens                                            │ │
│   └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Frontend Layers

| Layer         | Technology              | Responsibility                                                      |
|---------------|-------------------------|---------------------------------------------------------------------|
| Pages         | React components        | Route-level views: Login, Register, ChatRoom, AdminPanel, etc.      |
| Components    | React components        | Reusable: MessageBubble, RoomList, UserTable, AuditLogTable         |
| Context       | React Context API       | Global state: AuthContext (user, tokens), SocketContext (socket)    |
| Hooks         | Custom React hooks      | `useAuth`, `useRole`, `useSocket`, `useMessages`, `useRooms`        |
| API Layer     | Axios + interceptors    | HTTP calls; automatic token attachment and silent refresh           |
| Router        | React Router v6         | Client-side routing; `ProtectedRoute` wrapper enforces auth         |
| Types         | TypeScript interfaces   | `User`, `Message`, `ChatRoom`, `AuditLog`, `Role` enums             |

**ProtectedRoute** wraps all authenticated routes. It checks `AuthContext` for a valid user session; if absent, it redirects to `/login`. A separate `RoleProtectedRoute` wraps admin-only pages and redirects non-admins to a 403 page.

### 2.2 Backend Layers

| Layer         | Directory                    | Responsibility                                                  |
|---------------|------------------------------|-----------------------------------------------------------------|
| Routes        | `src/routes/`                | Define URL patterns; apply middleware chains                    |
| Middleware    | `src/middleware/`            | Auth, role guard, rate limiter, CSRF, error handler             |
| Validators    | `src/validators/`            | express-validator schemas per endpoint                          |
| Controllers   | `src/controllers/`           | Parse validated request → call service → format response        |
| Services      | `src/services/`              | Business logic: encryption, token management, audit writing     |
| Models        | `src/models/`                | Mongoose schemas with virtual getters/setters for encryption    |
| Sockets       | `src/sockets/`               | Socket.IO event handlers with JWT auth and room guards          |
| Config        | `src/config/`                | Database connection, environment variable validation            |
| Utils         | `src/utils/`                 | Response formatters, crypto helpers, constants                  |

### 2.3 Database Layer

MongoDB is used as the sole data store. Mongoose provides ODM functionality including schema validation, virtual properties (used for transparent encryption), and query middleware.

Collections:
- `users` — User accounts, encrypted emails, hashed passwords
- `chat_rooms` — Room definitions and member lists
- `messages` — Encrypted message bodies and metadata
- `audit_logs` — Immutable security event records
- `refresh_tokens` — Hashed refresh tokens with expiry
- `password_reset_tokens` — Hashed one-time reset tokens with expiry

---

## 3. Data Flow Diagrams

### 3.1 Authentication Flow

```
Browser           Axios Interceptor        Express Server            MongoDB
  │                      │                      │                       │
  │──POST /api/auth/login─────────────────────> │                       │
  │                      │                      │──findOne(email_index)─>│
  │                      │                      │<──User document────────│
  │                      │                      │──bcrypt.compare()      │
  │                      │                      │──sign accessToken      │
  │                      │                      │──sign refreshToken     │
  │                      │                      │──save RefreshToken──── >│
  │<──200 {accessToken}──────────────────────── │                       │
  │   Set-Cookie: refreshToken                  │                       │
  │                      │                      │                       │
  │  (store accessToken in AuthContext memory)   │                       │
  │                      │                      │                       │
  │──GET /api/auth/me ───────────────────────── >│                       │
  │  Authorization: Bearer <accessToken>         │                       │
  │                      │                      │──verifyJWT()           │
  │                      │                      │──findById(userId)──── >│
  │<──200 {user}──────────────────────────────── │                       │
  │                      │                      │                       │
  │ (15 min later — accessToken expires)         │                       │
  │                      │                      │                       │
  │──GET /api/chat/rooms ────────────────────── >│                       │
  │<──401 Unauthorized──────────────────────────  │                       │
  │                      │                      │                       │
  │      (interceptor catches 401)              │                       │
  │      ──POST /api/auth/refresh─────────────> │                       │
  │        Cookie: refreshToken=<t>             │──findOne(hash)──────── >│
  │                                             │<──RefreshToken doc─────│
  │                                             │──delete old token───── >│
  │                                             │──sign new accessToken   │
  │                                             │──sign new refreshToken  │
  │                                             │──save new RefreshToken─ >│
  │      <──200 {accessToken}────────────────── │                       │
  │      Set-Cookie: new refreshToken           │                       │
  │                      │                      │                       │
  │      (retry original request)               │                       │
  │──GET /api/chat/rooms ────────────────────── >│                       │
  │<──200 {rooms}──────────────────────────────── │                       │
```

### 3.2 Message Flow (REST)

```
Browser              Express               Encryption Service        MongoDB
  │                    │                         │                     │
  │─POST /rooms/:id/messages ──────────────────> │                     │
  │  { body: "Hello!" }                          │                     │
  │                    │──validateMessage()       │                     │
  │                    │──checkRoomMembership()── ─────────────────────>│
  │                    │<─────────────────────────────────────────────── │
  │                    │──encryptMessage("Hello!")──────────────────── >│
  │                    │<─"iv:authTag:ciphertext"                        │
  │                    │──Message.create({body_encrypted, sender, room})>│
  │                    │<─Message saved────────────────────────────────── │
  │                    │──writeAuditLog(MESSAGE_SENT)────────────────── >│
  │                    │──socket.to(roomId).emit('receive-message')      │
  │<─201 {message} ── │                         │                     │
```

### 3.3 WebSocket Message Flow

```
Sender Socket                Server (Socket.IO)          Recipient Sockets
     │                              │                           │
     │──emit('send-message', data)─>│                           │
     │                              │──verifyJWT(token)         │
     │                              │──checkMembership(roomId)  │
     │                              │──encryptMessage(body)     │
     │                              │──Message.create(...)      │
     │                              │──writeAuditLog(...)       │
     │                              │──to(roomId).emit('receive-message')>│
     │<──ack (optional) ────────────│                           │
     │                              │         │<──display message│
```

---

## 4. Database Schema Overview

### 4.1 User Model

```
users collection
├── _id             : ObjectId
├── name            : String (required, 2–100 chars)
├── email_encrypted : String (AES-256-GCM encrypted)
├── email_index     : String (HMAC-SHA256, unique index)
├── password_hash   : String (bcrypt)
├── role            : Enum ['employee', 'manager', 'admin']
├── isActive        : Boolean (default: true)
├── failedLoginAttempts : Number (default: 0)
├── lockUntil       : Date (null if not locked)
├── passwordHistory : [String] (last 5 bcrypt hashes)
├── createdAt       : Date
└── updatedAt       : Date
```

### 4.2 ChatRoom Model

```
chat_rooms collection
├── _id         : ObjectId
├── name        : String (required, 3–100 chars, unique)
├── description : String (max 500 chars)
├── members     : [ObjectId → users]
├── createdBy   : ObjectId → users
├── createdAt   : Date
└── updatedAt   : Date
```

### 4.3 Message Model

```
messages collection
├── _id             : ObjectId
├── body_encrypted  : String (AES-256-GCM: "iv:authTag:ciphertext")
├── sender          : ObjectId → users
├── room            : ObjectId → chat_rooms
├── isDeleted       : Boolean (default: false)
├── deletedBy       : ObjectId → users (null if not deleted)
├── createdAt       : Date
└── updatedAt       : Date
```

### 4.4 AuditLog Model

```
audit_logs collection
├── _id        : ObjectId
├── eventType  : Enum (see audit event types)
├── actorId    : ObjectId → users (nullable — null for unauthenticated events)
├── targetId   : ObjectId (nullable)
├── ipAddress  : String
├── userAgent  : String
├── metadata   : Mixed (event-specific JSON)
└── timestamp  : Date (immutable)
```

### 4.5 RefreshToken Model

```
refresh_tokens collection
├── _id        : ObjectId
├── tokenHash  : String (bcrypt hash of the raw refresh token)
├── userId     : ObjectId → users
├── expiresAt  : Date
├── createdAt  : Date
└── userAgent  : String (for device tracking)
```

### 4.6 PasswordResetToken Model

```
password_reset_tokens collection
├── _id        : ObjectId
├── tokenHash  : String (SHA-256 hash of the raw token)
├── userId     : ObjectId → users
├── expiresAt  : Date (1 hour from creation)
├── isUsed     : Boolean (default: false)
└── createdAt  : Date
```

---

## 5. Security Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Layer 1: Transport Security                     │
│         TLS 1.3 (Nginx) │ HSTS │ HTTP → HTTPS redirect             │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 2: Perimeter Defense                      │
│         Rate Limiting │ CORS Origin Whitelist │ Body Size Limit     │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 3: Request Integrity                      │
│         CSRF Token Verification │ Security Headers (Helmet)         │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 4: Authentication                         │
│         JWT Verification │ Signature Check │ Expiry Check           │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 5: Authorization                          │
│         RBAC Role Guard │ Room Membership Check                     │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 6: Input Validation                       │
│         express-validator │ Mongoose Schema Validation              │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 7: Business Logic                         │
│         Controllers │ Services │ Account Lockout                    │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 8: Data Protection                        │
│         AES-256-GCM Encryption │ bcrypt │ NoSQL Sanitization        │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 9: Audit & Monitoring                     │
│         Append-only Audit Log │ Server-side Error Logging           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. RBAC Design

### Role Hierarchy

```
Admin (Level 3)
  └── Inherits all Manager permissions
       └── Inherits all Employee permissions
            └── Base: authenticated user permissions
```

### Middleware Chain for a Protected Route

```typescript
router.get(
  '/api/users',
  authenticate,            // 1. Verify JWT, attach req.user
  requireRole('admin'),    // 2. Check role >= 'admin'
  rateLimiter,             // 3. Check rate limit
  listUsersController,     // 4. Execute handler
);
```

### `requireRole` Implementation

```typescript
function requireRole(minimumRole: Role) {
  return async (req, res, next) => {
    const user = await User.findById(req.user.id).select('role isActive');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const hierarchy = { employee: 1, manager: 2, admin: 3 };

    if (hierarchy[user.role] < hierarchy[minimumRole]) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    req.user.role = user.role; // Refresh role from DB (prevents stale JWT role)
    next();
  };
}
```

Re-fetching the role from the database on each sensitive request prevents stale-token privilege escalation (e.g., a user whose role was downgraded could otherwise use an old JWT to access elevated endpoints for up to 15 minutes).

---

## 7. Encryption Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Key Sources                             │
│                                                              │
│  ENCRYPTION_KEY (env) ──────┐                               │
│  EMAIL_HMAC_KEY (env) ──────┤──> Loaded once at startup     │
│  JWT_SECRET (env) ──────────┘    Never logged or returned   │
└──────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│  Message Body    │  │         Email Address                │
│                  │  │                                      │
│ AES-256-GCM      │  │  AES-256-GCM (for display)           │
│ Random IV/record │  │  HMAC-SHA256 (for lookup/uniqueness) │
│ Auth tag stored  │  │  Same ENCRYPTION_KEY                 │
│ Stored as:       │  │  Different EMAIL_HMAC_KEY for HMAC   │
│ iv:tag:ciphertext│  └──────────────────────────────────────┘
└──────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                       MongoDB                                │
│                                                              │
│  messages.body_encrypted = "4a3f...:8b2c...:9d1e..."        │
│  users.email_encrypted   = "1c2d...:3e4f...:5a6b..."        │
│  users.email_index       = "7f8a9b0c1d2e3f4a5b6c7d8e..."    │
└──────────────────────────────────────────────────────────────┘
```

Decryption occurs at the service/model layer before data is serialized into API responses. Raw ciphertext is never sent to clients.

---

## 8. API Design Principles

### RESTful Resource Naming

- Collections use plural nouns: `/users`, `/rooms`, `/messages`
- Individual resources identified by ID: `/users/:id`, `/rooms/:roomId`
- Sub-resources: `/rooms/:roomId/messages`, `/rooms/:roomId/messages/:messageId`
- Actions that don't map cleanly to CRUD use verb-based sub-routes: `/users/:id/activate`, `/users/:id/role`

### Consistent Response Envelope

Every response uses the same envelope:
- **Success**: `{ message?, data }` with appropriate 2xx status
- **Error**: `{ error, details? }` with appropriate 4xx/5xx status

### Versioning

The API is prefixed with `/api` (no version in v1.0.0). When breaking changes are introduced in the future, the prefix will become `/api/v2`.

### Pagination

All list endpoints support `page` and `limit` query parameters. Responses include a `pagination` object with `{ page, limit, total, pages }`.

### HTTP Semantics

| Operation         | Method | Status on Success |
|-------------------|--------|-------------------|
| Create resource   | POST   | 201 Created       |
| Read resource(s)  | GET    | 200 OK            |
| Update resource   | PUT    | 200 OK            |
| Partial update    | PATCH  | 200 OK            |
| Delete resource   | DELETE | 200 OK (soft del) |

`DELETE` returns 200 (not 204) because Shield-Chat uses soft deletes and returns a confirmation message body.
