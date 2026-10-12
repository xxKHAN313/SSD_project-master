# API Documentation — Shield-Chat

**Version**: 1.0.0
**Base URL**: `http://localhost:5000/api`
**Last Updated**: 2026-04-17

---

## Table of Contents

1. [General Conventions](#1-general-conventions)
2. [Authentication Endpoints](#2-authentication-endpoints)
3. [User Management Endpoints](#3-user-management-endpoints)
4. [Chat Room Endpoints](#4-chat-room-endpoints)
5. [Message Endpoints](#5-message-endpoints)
6. [Audit Log Endpoints](#6-audit-log-endpoints)
7. [Health Endpoint](#7-health-endpoint)
8. [WebSocket Events](#8-websocket-events)
9. [Error Reference](#9-error-reference)

---

## 1. General Conventions

### Authentication

Protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Access tokens are obtained via `POST /api/auth/login` or `POST /api/auth/refresh`.

### CSRF Token

All state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) require the `X-CSRF-Token` header. Obtain the CSRF token from the `XSRF-TOKEN` cookie set by the server on the first request.

```
X-CSRF-Token: <value from XSRF-TOKEN cookie>
```

### Response Format

All responses follow a consistent JSON structure:

**Success**:
```json
{
  "message": "Human-readable description",
  "data": { ... }
}
```

**Error**:
```json
{
  "error": "Error description",
  "details": [ ... ]
}
```

### Rate Limit Headers

All responses include rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1713350400
```

When a rate limit is exceeded, HTTP `429 Too Many Requests` is returned with:
```
Retry-After: 847
```

---

## 2. Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Authentication**: Not required
**Rate Limit**: 10 requests / 15 minutes per IP

**Request Body**:
```json
{
  "name": "string (2–100 characters, required)",
  "email": "string (valid email, required)",
  "password": "string (min 8 chars, requires upper/lower/digit/special, required)"
}
```

**Success Response** — `201 Created`:
```json
{
  "message": "Account created successfully. Please log in.",
  "data": {
    "userId": "64a1b2c3d4e5f6a7b8c9d0e1"
  }
}
```

**Error Responses**:

| Status | Condition                       | Body                                              |
|--------|---------------------------------|---------------------------------------------------|
| 400    | Validation failure              | `{ "error": "Validation failed", "details": [ { "field": "password", "message": "Password must contain at least one uppercase letter." } ] }` |
| 409    | Email already registered        | `{ "error": "An account with this email already exists." }` |
| 429    | Rate limit exceeded             | `{ "error": "Too many requests, please try again later." }` |

---

### POST /api/auth/login

Authenticate a user and receive tokens.

**Authentication**: Not required
**Rate Limit**: 10 requests / 15 minutes per IP

**Request Body**:
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Success Response** — `200 OK`:
```json
{
  "message": "Login successful.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "employee"
    }
  }
}
```

The refresh token is set as an `HttpOnly; Secure; SameSite=Strict` cookie named `refreshToken`.

**Error Responses**:

| Status | Condition                       | Body                                                    |
|--------|---------------------------------|---------------------------------------------------------|
| 400    | Validation failure              | `{ "error": "Validation failed", "details": [...] }`   |
| 401    | Wrong credentials               | `{ "error": "Invalid credentials." }`                  |
| 403    | Account deactivated             | `{ "error": "Your account has been deactivated. Contact an administrator." }` |
| 423    | Account locked                  | `{ "error": "Account locked due to too many failed attempts. Try again in 15 minutes." }` |
| 429    | Rate limit exceeded             | `{ "error": "Too many requests, please try again later." }` |

---

### POST /api/auth/logout

Log out the authenticated user.

**Authentication**: Required (any role)
**Rate Limit**: Global (100 / 15 min)

**Request Body**: None

**Success Response** — `200 OK`:
```json
{
  "message": "Logged out successfully."
}
```

The `refreshToken` cookie is cleared in the response.

**Error Responses**:

| Status | Condition          | Body                            |
|--------|--------------------|---------------------------------|
| 401    | No valid token     | `{ "error": "Unauthorized." }` |

---

### POST /api/auth/refresh

Exchange a refresh token for a new access token.

**Authentication**: Refresh token in `refreshToken` cookie
**Rate Limit**: Global (100 / 15 min)

**Request Body**: None

**Success Response** — `200 OK`:
```json
{
  "message": "Token refreshed.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

A new `refreshToken` cookie is set; the old one is invalidated.

**Error Responses**:

| Status | Condition                      | Body                                       |
|--------|--------------------------------|--------------------------------------------|
| 401    | Cookie missing or invalid      | `{ "error": "Refresh token is invalid or expired." }` |
| 401    | Token already used (replay)    | `{ "error": "Refresh token is invalid or expired." }` |

---

### POST /api/auth/forgot-password

Request a password reset email.

**Authentication**: Not required
**Rate Limit**: 10 requests / 15 minutes per IP

**Request Body**:
```json
{
  "email": "string (valid email, required)"
}
```

**Success Response** — `200 OK` *(always returned, regardless of whether email exists)*:
```json
{
  "message": "If that email address is registered, a password reset link has been sent."
}
```

---

### POST /api/auth/reset-password

Reset password using a token from the reset email.

**Authentication**: Not required
**Rate Limit**: 5 requests / 60 minutes per IP

**Request Body**:
```json
{
  "token": "string (64-character hex token from email, required)",
  "newPassword": "string (must meet strength requirements, required)"
}
```

**Success Response** — `200 OK`:
```json
{
  "message": "Password reset successfully. Please log in with your new password."
}
```

**Error Responses**:

| Status | Condition                      | Body                                            |
|--------|--------------------------------|-------------------------------------------------|
| 400    | Token expired or invalid       | `{ "error": "Reset token is invalid or has expired." }` |
| 400    | Password in history            | `{ "error": "New password cannot be one of your last 5 passwords." }` |
| 400    | Weak password                  | `{ "error": "Validation failed", "details": [...] }` |

---

### GET /api/auth/me

Get the authenticated user's profile.

**Authentication**: Required (any role)
**Rate Limit**: Global (100 / 15 min)

**Success Response** — `200 OK`:
```json
{
  "data": {
    "id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee",
    "isActive": true,
    "createdAt": "2026-04-17T10:00:00.000Z"
  }
}
```

---

## 3. User Management Endpoints

All user management endpoints require **Admin** role.

### GET /api/users

List all users.

**Authentication**: Required (Admin)
**Rate Limit**: Global (100 / 15 min)

**Query Parameters**:

| Parameter | Type   | Description                                         |
|-----------|--------|-----------------------------------------------------|
| `page`    | number | Page number (default: 1)                            |
| `limit`   | number | Results per page (default: 20, max: 100)            |
| `role`    | string | Filter by role: `employee`, `manager`, `admin`      |
| `active`  | boolean| Filter by active status                             |

**Success Response** — `200 OK`:
```json
{
  "data": {
    "users": [
      {
        "id": "64a1b2c3d4e5f6a7b8c9d0e1",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "manager",
        "isActive": true,
        "createdAt": "2026-04-10T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

---

### GET /api/users/:id

Get a specific user by ID.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**URL Parameters**: `id` — MongoDB ObjectId

**Success Response** — `200 OK`:
```json
{
  "data": {
    "id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "manager",
    "isActive": true,
    "failedLoginAttempts": 0,
    "createdAt": "2026-04-10T09:00:00.000Z",
    "updatedAt": "2026-04-15T14:30:00.000Z"
  }
}
```

**Error Responses**:

| Status | Condition     | Body                           |
|--------|---------------|--------------------------------|
| 400    | Invalid ID    | `{ "error": "Invalid user ID format." }` |
| 404    | Not found     | `{ "error": "User not found." }` |

---

### PUT /api/users/:id/role

Change a user's role.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Request Body**:
```json
{
  "role": "employee | manager | admin"
}
```

**Success Response** — `200 OK`:
```json
{
  "message": "User role updated successfully.",
  "data": {
    "userId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "previousRole": "employee",
    "newRole": "manager"
  }
}
```

**Error Responses**:

| Status | Condition           | Body                              |
|--------|---------------------|-----------------------------------|
| 400    | Invalid role value  | `{ "error": "Validation failed", "details": [...] }` |
| 403    | Changing own role   | `{ "error": "Admins cannot change their own role." }` |
| 404    | User not found      | `{ "error": "User not found." }` |

---

### PUT /api/users/:id/deactivate

Deactivate a user account.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Request Body**: None

**Success Response** — `200 OK`:
```json
{
  "message": "User account deactivated successfully."
}
```

---

### PUT /api/users/:id/activate

Reactivate a deactivated user account.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Success Response** — `200 OK`:
```json
{
  "message": "User account activated successfully."
}
```

---

## 4. Chat Room Endpoints

### GET /api/chat/rooms

List all chat rooms the authenticated user is a member of.

**Authentication**: Required (any role)
**Rate Limit**: Global

**Success Response** — `200 OK`:
```json
{
  "data": {
    "rooms": [
      {
        "id": "64b2c3d4e5f6a7b8c9d0e1f2",
        "name": "Project Alpha",
        "description": "Discussion room for Project Alpha",
        "memberCount": 5,
        "createdBy": {
          "id": "64a1b2c3d4e5f6a7b8c9d0e1",
          "name": "Jane Smith"
        },
        "createdAt": "2026-04-01T08:00:00.000Z"
      }
    ]
  }
}
```

---

### POST /api/chat/rooms

Create a new chat room.

**Authentication**: Required (Manager or Admin)
**Rate Limit**: Global

**Request Body**:
```json
{
  "name": "string (3–100 characters, required)",
  "description": "string (max 500 characters, optional)",
  "memberIds": ["64a1b2c3d4e5f6a7b8c9d0e1", "..."]
}
```

**Success Response** — `201 Created`:
```json
{
  "message": "Chat room created successfully.",
  "data": {
    "id": "64b2c3d4e5f6a7b8c9d0e1f2",
    "name": "Project Alpha",
    "description": "Discussion room for Project Alpha",
    "members": ["64a1b2c3d4e5f6a7b8c9d0e1", "..."],
    "createdAt": "2026-04-17T10:00:00.000Z"
  }
}
```

**Error Responses**:

| Status | Condition         | Body                                                |
|--------|-------------------|-----------------------------------------------------|
| 400    | Validation failure| `{ "error": "Validation failed", "details": [...] }` |
| 403    | Insufficient role | `{ "error": "Forbidden. Managers and Admins only." }` |

---

### GET /api/chat/rooms/:id

Get a specific chat room.

**Authentication**: Required (must be a member, or Admin)
**Rate Limit**: Global

**Success Response** — `200 OK`:
```json
{
  "data": {
    "id": "64b2c3d4e5f6a7b8c9d0e1f2",
    "name": "Project Alpha",
    "description": "Discussion room for Project Alpha",
    "members": [
      { "id": "64a1b2c3d4e5f6a7b8c9d0e1", "name": "John Doe", "role": "employee" }
    ],
    "createdBy": { "id": "64a1b2c3d4e5f6a7b8c9d0e2", "name": "Jane Smith" },
    "createdAt": "2026-04-01T08:00:00.000Z"
  }
}
```

**Error Responses**:

| Status | Condition         | Body                              |
|--------|-------------------|-----------------------------------|
| 403    | Not a member      | `{ "error": "You are not a member of this room." }` |
| 404    | Room not found    | `{ "error": "Chat room not found." }` |

---

## 5. Message Endpoints

### GET /api/chat/rooms/:roomId/messages

List messages in a chat room (paginated, newest first).

**Authentication**: Required (must be a room member, or Admin)
**Rate Limit**: Global

**Query Parameters**:

| Parameter | Type   | Description                            |
|-----------|--------|----------------------------------------|
| `page`    | number | Page number (default: 1)               |
| `limit`   | number | Messages per page (default: 50, max: 100) |

**Success Response** — `200 OK`:
```json
{
  "data": {
    "messages": [
      {
        "id": "64c3d4e5f6a7b8c9d0e1f2a3",
        "body": "Hello everyone!",
        "sender": {
          "id": "64a1b2c3d4e5f6a7b8c9d0e1",
          "name": "John Doe"
        },
        "roomId": "64b2c3d4e5f6a7b8c9d0e1f2",
        "isDeleted": false,
        "createdAt": "2026-04-17T10:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 128,
      "pages": 3
    }
  }
}
```

Note: `body` is the decrypted message content. Messages marked `isDeleted: true` show `body: "[Message deleted]"`.

---

### POST /api/chat/rooms/:roomId/messages

Send a message to a chat room.

**Authentication**: Required (must be a room member)
**Rate Limit**: 30 messages / 1 minute per user

**Request Body**:
```json
{
  "body": "string (1–2000 characters, required)"
}
```

**Success Response** — `201 Created`:
```json
{
  "message": "Message sent.",
  "data": {
    "id": "64c3d4e5f6a7b8c9d0e1f2a3",
    "body": "Hello everyone!",
    "sender": {
      "id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "name": "John Doe"
    },
    "roomId": "64b2c3d4e5f6a7b8c9d0e1f2",
    "createdAt": "2026-04-17T10:05:00.000Z"
  }
}
```

The message is also broadcast to all room members via the `receive-message` WebSocket event.

**Error Responses**:

| Status | Condition          | Body                                                |
|--------|--------------------|-----------------------------------------------------|
| 400    | Empty / too long   | `{ "error": "Validation failed", "details": [...] }` |
| 403    | Not a member       | `{ "error": "You are not a member of this room." }` |
| 429    | Rate limit         | `{ "error": "Message rate limit exceeded. Slow down." }` |

---

### DELETE /api/chat/rooms/:roomId/messages/:messageId

Delete a message (soft delete).

**Authentication**: Required (own message for Employee/Manager; any message for Admin)
**Rate Limit**: Global

**Success Response** — `200 OK`:
```json
{
  "message": "Message deleted."
}
```

**Error Responses**:

| Status | Condition              | Body                                          |
|--------|------------------------|-----------------------------------------------|
| 403    | Not own message        | `{ "error": "You can only delete your own messages." }` |
| 404    | Message not found      | `{ "error": "Message not found." }` |

---

## 6. Audit Log Endpoints

All audit endpoints require **Admin** role.

### GET /api/audit

List audit log entries.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Query Parameters**:

| Parameter   | Type   | Description                                                  |
|-------------|--------|--------------------------------------------------------------|
| `page`      | number | Page number (default: 1)                                     |
| `limit`     | number | Results per page (default: 50, max: 200)                     |
| `eventType` | string | Filter by event type (e.g., `USER_LOGIN_FAILED`)             |
| `actorId`   | string | Filter by actor user ID                                      |
| `startDate` | string | ISO 8601 date — only entries after this date                 |
| `endDate`   | string | ISO 8601 date — only entries before this date                |

**Success Response** — `200 OK`:
```json
{
  "data": {
    "logs": [
      {
        "id": "64d4e5f6a7b8c9d0e1f2a3b4",
        "eventType": "USER_LOGIN_FAILED",
        "actorId": null,
        "targetId": null,
        "ipAddress": "192.168.1.100",
        "userAgent": "Mozilla/5.0 ...",
        "metadata": { "reason": "wrong_password" },
        "timestamp": "2026-04-17T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 342,
      "pages": 7
    }
  }
}
```

---

### GET /api/audit/export

Export audit logs as a CSV file.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Query Parameters**: Same as `GET /api/audit` (filters applied to export).

**Success Response** — `200 OK`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="audit-log-2026-04-17.csv"`
- Body: CSV file with headers: `id,eventType,actorId,targetId,ipAddress,userAgent,metadata,timestamp`

---

## 7. Health Endpoint

### GET /api/health

Check service health status.

**Authentication**: Required (Admin)
**Rate Limit**: Global

**Success Response** — `200 OK`:
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

**Degraded Response** — `503 Service Unavailable`:
```json
{
  "status": "degraded",
  "uptime": 86400,
  "timestamp": "2026-04-17T10:00:00.000Z",
  "services": {
    "database": "disconnected",
    "server": "running"
  }
}
```

---

## 8. WebSocket Events

The WebSocket server runs on the same port as the HTTP server, accessible at `ws://localhost:5000` (or `wss://` in production).

**Connection**: Clients must pass the JWT access token as a query parameter on connection:

```javascript
const socket = io('http://localhost:5000', {
  withCredentials: true,
  auth: { token: accessToken },
});
```

The server verifies the JWT on connection. If invalid, the connection is rejected with a `connect_error` event.

---

### Client → Server Events

#### `join-room`

Subscribe to a chat room's real-time events.

```javascript
socket.emit('join-room', { roomId: '64b2c3d4e5f6a7b8c9d0e1f2' });
```

The server validates room membership before allowing the join. Non-members receive an `error` event.

---

#### `leave-room`

Unsubscribe from a chat room.

```javascript
socket.emit('leave-room', { roomId: '64b2c3d4e5f6a7b8c9d0e1f2' });
```

---

#### `send-message`

Send a message to a room via WebSocket (alternative to REST endpoint).

```javascript
socket.emit('send-message', {
  roomId: '64b2c3d4e5f6a7b8c9d0e1f2',
  body: 'Hello everyone!',
});
```

The server saves the encrypted message and broadcasts `receive-message` to all room members.

---

#### `typing`

Broadcast a typing indicator to other room members.

```javascript
socket.emit('typing', { roomId: '64b2c3d4e5f6a7b8c9d0e1f2' });
```

---

#### `stop-typing`

Broadcast that the user has stopped typing.

```javascript
socket.emit('stop-typing', { roomId: '64b2c3d4e5f6a7b8c9d0e1f2' });
```

---

### Server → Client Events

#### `receive-message`

Fired when a new message arrives in a joined room.

```javascript
socket.on('receive-message', (data) => {
  // data:
  // {
  //   id: '64c3d4e5f6a7b8c9d0e1f2a3',
  //   body: 'Hello everyone!',        // decrypted
  //   sender: { id, name },
  //   roomId: '64b2c3d4e5f6a7b8c9d0e1f2',
  //   createdAt: '2026-04-17T10:05:00.000Z'
  // }
});
```

---

#### `user-joined`

Fired when another user joins the room.

```javascript
socket.on('user-joined', (data) => {
  // data: { userId, name, roomId }
});
```

---

#### `user-left`

Fired when another user leaves the room.

```javascript
socket.on('user-left', (data) => {
  // data: { userId, name, roomId }
});
```

---

#### `typing`

Fired when another user in the room is typing.

```javascript
socket.on('typing', (data) => {
  // data: { userId, name, roomId }
});
```

---

#### `stop-typing`

Fired when another user in the room stops typing.

```javascript
socket.on('stop-typing', (data) => {
  // data: { userId, name, roomId }
});
```

---

#### `error`

Fired when the server encounters an error processing a client event.

```javascript
socket.on('error', (data) => {
  // data: { message: 'You are not a member of this room.' }
});
```

---

#### `connect_error`

Fired if the JWT is invalid on initial connection.

```javascript
socket.on('connect_error', (err) => {
  // err.message: 'Authentication failed.'
});
```

---

## 9. Error Reference

| HTTP Status | Meaning                      | Common Causes                                           |
|-------------|------------------------------|---------------------------------------------------------|
| 400         | Bad Request                  | Validation failure, malformed JSON, invalid ObjectId    |
| 401         | Unauthorized                 | Missing token, expired token, invalid token             |
| 403         | Forbidden                    | Insufficient role, not a room member                    |
| 404         | Not Found                    | Resource does not exist                                 |
| 409         | Conflict                     | Duplicate email on registration                         |
| 413         | Payload Too Large            | Request body exceeds 10 KB                              |
| 423         | Locked                       | Account locked due to failed login attempts             |
| 429         | Too Many Requests            | Rate limit exceeded                                     |
| 500         | Internal Server Error        | Unexpected server error (details in server logs only)   |
| 503         | Service Unavailable          | Database connection lost                                |
