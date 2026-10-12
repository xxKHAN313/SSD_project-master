# Developer Guide — Shield-Chat

**Version**: 1.0.0
**Last Updated**: 2026-04-17

This guide covers coding standards, conventions, and workflows for contributors to Shield-Chat.

---

## Table of Contents

1. [Code Style Guide](#1-code-style-guide)
2. [Adding New Features](#2-adding-new-features)
3. [Adding New Roles](#3-adding-new-roles)
4. [Security Checklist for New Endpoints](#4-security-checklist-for-new-endpoints)
5. [Audit Logging Guide](#5-audit-logging-guide)
6. [Testing Guide](#6-testing-guide)
7. [Git Workflow](#7-git-workflow)
8. [Code Review Checklist](#8-code-review-checklist)

---

## 1. Code Style Guide

### TypeScript Configuration

Both `backend` and `frontend` use TypeScript in **strict mode**. The `tsconfig.json` in each package enables:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

TypeScript errors are treated as build failures in CI — all type errors must be resolved before merging.

### Naming Conventions

| Construct                    | Convention        | Example                                  |
|------------------------------|-------------------|------------------------------------------|
| Variables and parameters     | camelCase         | `userId`, `accessToken`, `roomId`        |
| Functions and methods        | camelCase         | `encryptMessage()`, `writeAuditLog()`    |
| Classes and interfaces       | PascalCase        | `UserService`, `IUserDocument`           |
| TypeScript enums             | PascalCase values | `Role.Admin`, `AuditEventType.UserLogin` |
| Constants                    | UPPER_SNAKE_CASE  | `MAX_LOGIN_ATTEMPTS`, `BCRYPT_ROUNDS`    |
| File names (backend)         | camelCase         | `authController.ts`, `userService.ts`    |
| File names (frontend)        | PascalCase for components | `LoginPage.tsx`, `MessageBubble.tsx` |
| MongoDB collection names     | snake_case plural | `audit_logs`, `chat_rooms`               |
| Environment variables        | UPPER_SNAKE_CASE  | `ENCRYPTION_KEY`, `JWT_SECRET`           |

### File Organization

**Backend** — one file per responsibility:
```
src/controllers/authController.ts      # Request handling only
src/services/encryptionService.ts      # Business logic only
src/models/User.ts                     # Schema + types only
src/validators/authValidator.ts        # Validation rules only
src/routes/authRoutes.ts               # Route definitions only
src/middleware/authMiddleware.ts        # Middleware functions only
```

**Frontend** — co-located by feature:
```
src/pages/LoginPage/
  ├── LoginPage.tsx
  ├── LoginPage.test.tsx
  └── index.ts

src/components/MessageBubble/
  ├── MessageBubble.tsx
  ├── MessageBubble.test.tsx
  └── index.ts
```

### Code Formatting

ESLint and Prettier are configured in both packages. Before committing:

```bash
npm run lint        # Check for lint errors
npm run lint:fix    # Auto-fix fixable lint errors
```

Key rules enforced:
- No `any` type (use `unknown` if the type is truly unknown, then narrow it)
- No non-null assertions (`!`) except in tests
- Async functions must have `await` or return a Promise
- All `catch` blocks must handle or re-throw the error (no empty catch)
- Console statements (`console.log`) are disallowed in production code — use the logger

### Logger Usage

Use the project logger (Winston-based) instead of `console`:

```typescript
import logger from '../utils/logger';

logger.info('User logged in', { userId, ip });
logger.warn('Account locked', { email_index, ip });
logger.error('Encryption failed', { error: err.message, messageId });
```

Never log sensitive data: passwords, encryption keys, raw tokens, full email addresses.

---

## 2. Adding New Features

Follow this checklist in order when adding a new feature. Each step is required.

### Step 1: Mongoose Model (if new data is needed)

Create `backend/src/models/NewModel.ts`:

```typescript
import { Schema, model, Document } from 'mongoose';

export interface INewModel extends Document {
  field: string;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
}

const NewModelSchema = new Schema<INewModel>({
  field: { type: String, required: true, trim: true, maxlength: 200 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

NewModelSchema.index({ userId: 1 });

export const NewModel = model<INewModel>('NewModel', NewModelSchema);
```

### Step 2: Service Layer

Create `backend/src/services/newFeatureService.ts` with business logic only. Services must not access `req` or `res`.

```typescript
export async function createThing(userId: string, data: CreateThingDto): Promise<INewModel> {
  // validation beyond express-validator (business rules)
  // call model
  // call auditService.writeAuditLog(...)
  return result;
}
```

### Step 3: Validator

Create `backend/src/validators/newFeatureValidator.ts`:

```typescript
import { body } from 'express-validator';

export const createThingValidator = [
  body('field')
    .trim()
    .notEmpty().withMessage('Field is required.')
    .isLength({ max: 200 }).withMessage('Field must be 200 characters or fewer.')
    .escape(),
];
```

### Step 4: Controller

Create `backend/src/controllers/newFeatureController.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { createThing } from '../services/newFeatureService';

export async function createThingController(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }

  try {
    const result = await createThing(req.user!.id, req.body);
    return res.status(201).json({ message: 'Created successfully.', data: result });
  } catch (err) {
    next(err); // Pass to centralized error handler
  }
}
```

### Step 5: Route Definition

Create or update `backend/src/routes/newFeatureRoutes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { globalLimiter } from '../middleware/rateLimiter';
import { csrfProtection } from '../middleware/csrfMiddleware';
import { createThingValidator } from '../validators/newFeatureValidator';
import { createThingController } from '../controllers/newFeatureController';

const router = Router();

router.post(
  '/',
  csrfProtection,
  authenticate,
  requireRole('employee'),  // minimum role required
  globalLimiter,
  createThingValidator,
  createThingController,
);

export default router;
```

Register the router in `backend/src/app.ts`:

```typescript
import newFeatureRoutes from './routes/newFeatureRoutes';
app.use('/api/new-feature', newFeatureRoutes);
```

### Step 6: Frontend API Function

Add to `frontend/src/api/newFeatureApi.ts`:

```typescript
import axiosInstance from './axios';

export async function createThing(data: CreateThingRequest): Promise<CreateThingResponse> {
  const response = await axiosInstance.post<CreateThingResponse>('/new-feature', data);
  return response.data;
}
```

### Step 7: Frontend Hook or Component

```typescript
// frontend/src/hooks/useNewFeature.ts
import { useState } from 'react';
import { createThing } from '../api/newFeatureApi';

export function useNewFeature() {
  const [loading, setLoading] = useState(false);

  const create = async (data: CreateThingRequest) => {
    setLoading(true);
    try {
      return await createThing(data);
    } finally {
      setLoading(false);
    }
  };

  return { create, loading };
}
```

---

## 3. Adding New Roles

Adding a new role (e.g., `moderator`) requires updating several files. Follow each step:

### Step 1: Update the Role Enum

`backend/src/types/roles.ts`:
```typescript
export enum Role {
  Employee = 'employee',
  Moderator = 'moderator',   // NEW
  Manager = 'manager',
  Admin = 'admin',
}
```

### Step 2: Update Role Hierarchy

`backend/src/middleware/roleMiddleware.ts`:
```typescript
const hierarchy: Record<string, number> = {
  employee: 1,
  moderator: 2,   // NEW — between employee and manager
  manager: 3,
  admin: 4,
};
```

### Step 3: Update User Model

`backend/src/models/User.ts`:
```typescript
role: {
  type: String,
  enum: ['employee', 'moderator', 'manager', 'admin'],  // add 'moderator'
  default: 'employee',
},
```

### Step 4: Update Validators

`backend/src/validators/userValidator.ts`:
```typescript
body('role')
  .isIn(['employee', 'moderator', 'manager', 'admin'])
  .withMessage('Invalid role.'),
```

### Step 5: Update Frontend Role Hook

`frontend/src/hooks/useRole.ts`:
```typescript
export type Role = 'employee' | 'moderator' | 'manager' | 'admin';

const hierarchy: Record<Role, number> = {
  employee: 1,
  moderator: 2,
  manager: 3,
  admin: 4,
};

export function useRole() {
  const { user } = useAuth();

  const hasRole = (minimumRole: Role): boolean => {
    if (!user) return false;
    return hierarchy[user.role as Role] >= hierarchy[minimumRole];
  };

  return { role: user?.role, hasRole, isAdmin: hasRole('admin') };
}
```

### Step 6: Update UI Components

Review all components that conditionally render based on role and update as needed:
- `AdminPanel.tsx` — role-restricted pages
- `RoomList.tsx` — role-based feature visibility
- `UserTable.tsx` — role display and role assignment dropdown

---

## 4. Security Checklist for New Endpoints

Before merging any new API endpoint, verify every item:

**Authentication & Authorization**:
- [ ] The endpoint applies `authenticate` middleware (or is intentionally public with justification)
- [ ] The endpoint applies `requireRole(minimumRole)` with the correct minimum role
- [ ] For resource-scoped access (e.g., room membership), a membership check middleware is applied
- [ ] The required role is documented in the API documentation

**Input Validation**:
- [ ] A validator file exists for this endpoint's request body
- [ ] All string fields have `.trim()` and `.escape()` applied
- [ ] All string fields have `maxlength` enforced
- [ ] ObjectId URL parameters are validated with `param('id').isMongoId()`
- [ ] `validationResult(req)` is checked at the top of the controller
- [ ] Enum fields are validated with `.isIn([...allowedValues])`

**Rate Limiting**:
- [ ] At minimum, the `globalLimiter` middleware is applied
- [ ] Authentication-related endpoints use `authLimiter`
- [ ] If the endpoint has abuse potential (bulk operations, email sending), a custom stricter limiter is added

**CSRF**:
- [ ] All state-mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) apply `csrfProtection` middleware
- [ ] GET endpoints do not modify state

**Audit Logging**:
- [ ] Every security-relevant action writes an audit log entry (see Section 5)
- [ ] The audit event type is added to the `AuditEventType` enum

**Error Handling**:
- [ ] All async operations are wrapped in `try/catch` and pass errors to `next(err)`
- [ ] No stack traces or internal error details are included in HTTP responses
- [ ] 404 errors are returned for non-existent resources (not 403, which would confirm existence)

**Response**:
- [ ] Success responses follow the `{ message, data }` envelope
- [ ] No sensitive fields are included in responses (passwords, tokens, internal IDs beyond what's needed)

---

## 5. Audit Logging Guide

### How to Write an Audit Log Entry

```typescript
import { writeAuditLog } from '../services/auditService';

// Inside a controller or service, after a security-relevant action:
await writeAuditLog({
  eventType: 'MESSAGE_DELETED',
  actorId: req.user.id,
  targetId: message._id.toString(),
  ipAddress: req.ip,
  userAgent: req.get('User-Agent') || 'unknown',
  metadata: {
    roomId: message.room.toString(),
    reason: 'admin_action',
  },
});
```

### Adding a New Audit Event Type

**Step 1**: Add the new event type to the enum in `backend/src/types/auditEvents.ts`:

```typescript
export type AuditEventType =
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  // ... existing events ...
  | 'YOUR_NEW_EVENT';   // Add here
```

**Step 2**: Update the Mongoose schema enum in `backend/src/models/AuditLog.ts`:

```typescript
eventType: {
  type: String,
  enum: [
    'USER_REGISTERED',
    // ... existing events ...
    'YOUR_NEW_EVENT',    // Add here
  ],
},
```

**Step 3**: Document the new event in the `CHANGELOG.md` and `docs/SECURITY_DOCUMENTATION.md`.

### Audit Logging Rules

- **Every login attempt** (success and failure) must be logged
- **Every privilege escalation** must be logged with before/after state
- **Every data deletion** must be logged with the resource identifier
- **Every admin action** must be logged
- Audit logs are **never** updated or deleted programmatically
- The `actorId` is `null` for unauthenticated events (e.g., failed login before the user is identified)

---

## 6. Testing Guide

### Test Structure

```
backend/
  src/
    __tests__/
      controllers/
        auth.test.ts
        users.test.ts
      services/
        encryptionService.test.ts
        auditService.test.ts
      middleware/
        authMiddleware.test.ts

frontend/
  src/
    pages/LoginPage/LoginPage.test.tsx
    components/MessageBubble/MessageBubble.test.tsx
    hooks/useAuth.test.ts
```

### Running Tests

```bash
# Backend
cd backend
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage report

# Frontend
cd frontend
npm test                    # Run all tests (interactive)
npm test -- --watchAll=false # Run once (CI mode)
npm test -- --coverage      # With coverage report
```

### Writing Backend Tests

Use Jest + Supertest for controller tests:

```typescript
import request from 'supertest';
import app from '../../app';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('POST /api/auth/login', () => {
  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials.');
    // Ensure no sensitive info is leaked
    expect(res.body).not.toHaveProperty('hash');
    expect(res.body).not.toHaveProperty('stack');
  });
});
```

Use `mongodb-memory-server` for in-memory database tests — never test against a real MongoDB instance.

### Writing Frontend Tests

Use React Testing Library:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from './LoginPage';

test('shows error message on invalid credentials', async () => {
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'wrong@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'wrongpassword' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => {
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

### Coverage Requirements

The CI pipeline enforces minimum coverage thresholds:

| Metric     | Minimum |
|------------|---------|
| Statements | 70%     |
| Branches   | 65%     |
| Functions  | 70%     |
| Lines      | 70%     |

Prioritize testing: middleware (auth, role guards), services (encryption, audit), and controllers (validation rejection cases).

---

## 7. Git Workflow

### Branch Naming

| Type        | Pattern                 | Example                          |
|-------------|-------------------------|----------------------------------|
| Feature     | `feature/<description>` | `feature/message-encryption`     |
| Bug fix     | `fix/<description>`     | `fix/refresh-token-replay`       |
| Security    | `security/<description>`| `security/csrf-fix`              |
| Docs        | `docs/<description>`    | `docs/api-documentation`         |
| Refactor    | `refactor/<description>`| `refactor/audit-service`         |

All branches are created from `main`.

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE or closes #issue]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `security`

Examples:
```
feat(auth): add account lockout after 5 failed attempts
fix(encryption): correct IV length from 16 to 12 bytes for GCM mode
security(csrf): apply csrfProtection to all state-mutating routes
docs(api): add WebSocket event documentation
```

### Pull Request Process

1. Create a branch from `main`
2. Implement the feature / fix
3. Write or update tests
4. Ensure `npm run lint` and `npm test` pass locally
5. Push the branch and open a pull request
6. Fill in the PR template (description, testing steps, security considerations)
7. Request review from at least one other developer
8. Address all review comments
9. Merge after approval (squash merge preferred to keep `main` history clean)

---

## 8. Code Review Checklist

Use this checklist when reviewing pull requests.

### Correctness
- [ ] The code does what the PR description says it does
- [ ] Edge cases are handled (empty arrays, null values, missing fields)
- [ ] Error paths are handled and reach the centralized error handler

### Security
- [ ] New endpoints follow the [Security Checklist for New Endpoints](#4-security-checklist-for-new-endpoints)
- [ ] No secrets, passwords, or tokens are logged or included in responses
- [ ] User-supplied input is validated before use
- [ ] No direct string interpolation into database queries
- [ ] New dependencies are reviewed (`npm audit` output examined)

### Code Quality
- [ ] TypeScript strict mode is satisfied (no `any`, no non-null assertions in prod code)
- [ ] Functions are small and single-purpose
- [ ] No dead code or commented-out code blocks
- [ ] No `console.log` statements (use logger)
- [ ] Variable and function names are descriptive

### Tests
- [ ] Tests cover the happy path
- [ ] Tests cover at least one error/rejection path
- [ ] Tests do not depend on external services (use mocks or `mongodb-memory-server`)
- [ ] Existing tests still pass

### Documentation
- [ ] New endpoints are documented in `docs/API_DOCUMENTATION.md`
- [ ] New audit event types are documented in `docs/SECURITY_DOCUMENTATION.md`
- [ ] `CHANGELOG.md` is updated for user-visible changes
- [ ] Complex logic has inline comments explaining the "why"
