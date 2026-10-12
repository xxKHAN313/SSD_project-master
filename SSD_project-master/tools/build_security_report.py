"""
Generates Shield-Chat_Security_Map.pdf — a guide to where every piece of
security code lives in the project and what each piece does.
"""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
    KeepTogether,
)

OUT = Path(r"C:\Ammar\Coding\SSD_project\Shield-Chat_Security_Map.pdf")

# ------------ styles ------------
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name="DocTitle",
    parent=styles["Title"],
    fontSize=22,
    leading=26,
    spaceAfter=6,
    textColor=colors.HexColor("#0F172A"),
))
styles.add(ParagraphStyle(
    name="DocSubtitle",
    parent=styles["Normal"],
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#475569"),
    spaceAfter=18,
))
styles.add(ParagraphStyle(
    name="H1",
    parent=styles["Heading1"],
    fontSize=16,
    leading=20,
    spaceBefore=14,
    spaceAfter=8,
    textColor=colors.HexColor("#1E40AF"),
))
styles.add(ParagraphStyle(
    name="H2",
    parent=styles["Heading2"],
    fontSize=13,
    leading=16,
    spaceBefore=10,
    spaceAfter=4,
    textColor=colors.HexColor("#1E3A8A"),
))
styles.add(ParagraphStyle(
    name="FilePath",
    parent=styles["Normal"],
    fontName="Courier-Bold",
    fontSize=9.5,
    leading=12,
    textColor=colors.HexColor("#0F172A"),
    backColor=colors.HexColor("#F1F5F9"),
    borderPadding=(3, 4, 3, 4),
    spaceBefore=2,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Body",
    parent=styles["Normal"],
    fontSize=10,
    leading=13.5,
    spaceAfter=6,
    alignment=TA_LEFT,
    textColor=colors.HexColor("#1F2937"),
))
styles.add(ParagraphStyle(
    name="MyBullet",
    parent=styles["Normal"],
    fontSize=10,
    leading=13.5,
    leftIndent=14,
    bulletIndent=2,
    spaceAfter=2,
    textColor=colors.HexColor("#1F2937"),
))
styles.add(ParagraphStyle(
    name="MyCode",
    parent=styles["Code"],
    fontName="Courier",
    fontSize=8.5,
    leading=11,
    textColor=colors.HexColor("#0F172A"),
    backColor=colors.HexColor("#F8FAFC"),
    borderPadding=(4, 6, 4, 6),
    spaceBefore=2,
    spaceAfter=8,
))


def H1(text):
    return Paragraph(text, styles["H1"])


def H2(text):
    return Paragraph(text, styles["H2"])


def P(text):
    return Paragraph(text, styles["Body"])


def Path_(text):
    return Paragraph(text, styles["FilePath"])


def Bul(text):
    return Paragraph(f"&bull;&nbsp;&nbsp;{text}", styles["MyBullet"])


def Code(text):
    text = (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\n", "<br/>"))
    return Paragraph(text, styles["Code"])


def file_block(path, what, points, code=None):
    """A standard 'file + role + bullets' block, kept together on one page if possible."""
    elems = [Path_(path), P(f"<b>What it does.</b> {what}")]
    for pt in points:
        elems.append(Bul(pt))
    if code:
        elems.append(Spacer(1, 2))
        elems.append(Code(code))
    elems.append(Spacer(1, 4))
    return KeepTogether(elems)


# ------------ build ------------
doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    topMargin=16 * mm,
    bottomMargin=16 * mm,
    title="Shield-Chat Security Map",
    author="Shield-Chat",
)

story = []

# ------------ cover ------------
story.append(Paragraph("Shield-Chat Security Map", styles["DocTitle"]))
story.append(Paragraph(
    "Where every piece of security code lives in the project, and what each piece does.",
    styles["DocSubtitle"],
))

story.append(P(
    "Shield-Chat is a role-based secure messaging portal. Security is layered: "
    "secrets validation at boot, a hardened HTTP middleware pipeline, encrypted data "
    "at rest, JWT + session-tracked auth, RBAC, rate limiting, input sanitisation, "
    "audit logging, and a locked-down container image. This document maps each "
    "concern to the exact file(s) that implement it."
))

# ------------ summary table ------------
story.append(H1("1. At-a-glance map"))
data = [
    ["Security concern", "Primary file(s)"],
    ["Environment / secrets validation", "backend/src/config/environment.ts"],
    ["Security constants (lockout, policy, rate limits)", "backend/src/config/constants.ts"],
    ["Central security config (CSP, CORS, cookies, JWT)", "backend/src/config/security.ts"],
    ["RBAC role + permission map", "backend/src/config/roles.ts"],
    ["HTTP security headers (Helmet)", "backend/src/middleware/securityHeaders.ts"],
    ["Per-request CSP nonce", "backend/src/middleware/cspNonce.ts"],
    ["Strip Server / X-Powered-By", "backend/src/middleware/serverHeader.ts"],
    ["CSRF (double-submit cookie)", "backend/src/middleware/csrfProtection.ts"],
    ["CORS allow-list + tunnel patterns", "backend/src/middleware/corsMiddleware.ts + config/security.ts"],
    ["JWT verification on HTTP routes", "backend/src/middleware/authMiddleware.ts"],
    ["Role-based access control on routes", "backend/src/middleware/roleMiddleware.ts"],
    ["Rate limiting (login, API, messages, reset)", "backend/src/middleware/rateLimiter.ts"],
    ["Input validation (express-validator)", "backend/src/middleware/validationMiddleware.ts"],
    ["Generic error handling (no info leak)", "backend/src/middleware/errorHandler.ts"],
    ["AES-256-GCM encrypt/decrypt", "backend/src/utils/encryption.ts"],
    ["bcrypt hashing + password policy", "backend/src/utils/passwordUtils.ts"],
    ["JWT sign/verify (access + refresh)", "backend/src/utils/tokenUtils.ts"],
    ["XSS / NoSQL input sanitisation", "backend/src/utils/sanitizers.ts"],
    ["Login, register, lockout, password reset", "backend/src/services/authService.ts"],
    ["Token rotation, session revocation", "backend/src/services/tokenService.ts"],
    ["Audit log writes (immutable)", "backend/src/services/auditService.ts"],
    ["Email + message encryption helpers", "backend/src/services/encryptionService.ts"],
    ["User model: lockout, password history", "backend/src/models/User.ts"],
    ["Socket.io JWT auth", "backend/src/websocket/socketAuth.ts"],
    ["Middleware pipeline (ordering)", "backend/src/app.ts"],
    ["CSRF auto-attach (axios xsrf options)", "frontend/src/services/api.ts"],
    ["CSP nonce placeholder in SPA shell", "frontend/public/index.html"],
    ["Non-root container, no source maps", "Dockerfile"],
    ["Build-context exclusions (.env, secrets)", ".dockerignore"],
]
tbl = Table(data, colWidths=[78 * mm, 96 * mm])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("FONTNAME", (1, 1), (1, -1), "Courier"),
    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
]))
story.append(tbl)
story.append(PageBreak())

# ============================================================
# 2. Configuration layer
# ============================================================
story.append(H1("2. Configuration &amp; secrets"))

story.append(file_block(
    "backend/src/config/environment.ts",
    "Centralises all environment-variable reading and validates required values at boot. The app refuses to start if any secret is missing or weak.",
    [
        "Throws if <b>JWT_ACCESS_SECRET</b> or <b>JWT_REFRESH_SECRET</b> is shorter than 32 characters.",
        "Throws if <b>ENCRYPTION_KEY</b> is not exactly 64 hex chars (32 bytes — required for AES-256).",
        "Loads <b>MONGODB_URI</b>, JWT expiry, bcrypt rounds, CORS origin list, rate-limit windows, log level.",
        "Exports a frozen <code>env</code> object so no other module can mutate the configuration.",
    ],
))

story.append(file_block(
    "backend/src/config/constants.ts",
    "All security-relevant numbers in one place — no magic numbers scattered through the code.",
    [
        "<b>RATE_LIMITS</b>: 5 logins / 15 min, 100 API / min, 10 messages / min, 3 password resets / hour, etc.",
        "<b>LOCKOUT_POLICY</b>: 5 failed attempts → 30-minute account lock.",
        "<b>PASSWORD_POLICY</b>: min 8 chars, max 72, requires upper + lower + digit + special, history depth 5.",
        "<b>TOKEN_EXPIRY</b>: access 1 h, refresh 7 d, password-reset 1 h.",
        "<b>AUDIT_ACTIONS</b> + <b>AUDIT_SEVERITY</b> enums used by every audit-log write.",
        "<b>HTTP_STATUS</b>, <b>COOKIE_NAMES</b>, <b>ROLES</b>, <b>ROOM_ACCESS</b> constants.",
    ],
))

story.append(file_block(
    "backend/src/config/security.ts",
    "Central object describing the application's security posture: bcrypt rounds, JWT options, cookie flags, CORS rules, and CSP directives.",
    [
        "<b>BCRYPT_ROUNDS</b> — work factor for password hashing (12 in production).",
        "<b>JWT_ACCESS_OPTIONS</b> / <b>JWT_REFRESH_OPTIONS</b> — HS256, issuer <i>shield-chat</i>, audience <i>shield-chat-client</i>, with explicit expiries.",
        "<b>ACCESS_TOKEN_COOKIE_OPTIONS</b> / <b>REFRESH_TOKEN_COOKIE_OPTIONS</b> — httpOnly, Secure (in prod), SameSite=Strict, refresh cookie scoped to <code>/api/auth/refresh</code>.",
        "<b>CORS_OPTIONS</b> — wildcard-free origin function: explicit allow-list + regex patterns for <code>*.trycloudflare.com</code>, <code>*.ngrok-free.app</code>, <code>*.serveo.net</code>, etc. Private LAN ranges (<code>192.168.*</code>, <code>10.*</code>, <code>172.16-31.*</code>, <code>127.*</code>) only accepted in non-production.",
        "<b>CSP_DIRECTIVES</b> — nonce-based <code>script-src</code> / <code>style-src-elem</code>, <code>script-src-attr 'none'</code>, <code>frame-ancestors 'none'</code>, <code>base-uri 'self'</code>, <code>form-action 'self'</code>, <code>object-src 'none'</code>; the nonce is read at request time from <code>res.locals.cspNonce</code>.",
    ],
))

story.append(file_block(
    "backend/src/config/roles.ts",
    "RBAC source of truth: enumerates every permission and maps each role to the permissions it grants.",
    [
        "<b>ROLE_HIERARCHY</b>: employee=1 &lt; manager=2 &lt; admin=3 — used by <code>isAtLeastRole()</code> for &quot;at least manager&quot; style checks.",
        "<b>PERMISSIONS</b> object: USER_VIEW_ALL, USER_ASSIGN_ROLE, MESSAGE_DELETE_ANY, AUDIT_VIEW, AUDIT_EXPORT, etc.",
        "<b>ROLE_PERMISSIONS</b>: explicit per-role list — default-deny (anything not listed is denied).",
        "<code>hasPermission(role, perm)</code> and <code>getRolesWithPermission(perm)</code> helpers.",
    ],
))

# ============================================================
# 3. Middleware pipeline
# ============================================================
story.append(PageBreak())
story.append(H1("3. The HTTP middleware pipeline"))

story.append(P(
    "Order matters. <code>backend/src/app.ts</code> wires middleware in a security-first sequence "
    "so every response — including errors — gets headers set, server fingerprints stripped, and "
    "CSRF / auth checks applied before any route logic runs."
))

pipeline = [
    ("1. app.disable('x-powered-by')", "Suppresses Express's default fingerprint."),
    ("2. stripServerHeaders", "Removes Server / X-Powered-By again on every response, plus on writeHead."),
    ("3. cspNonce", "Mints a fresh base64 nonce into res.locals.cspNonce — must run BEFORE helmet."),
    ("4. securityHeaders (helmet)", "CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP, CORP, etc."),
    ("5. corsMiddleware", "Origin allow-list (explicit + tunnel regex). Handles OPTIONS preflight."),
    ("6. cookieParser", "Parses Cookie header so JWT and XSRF cookies are readable."),
    ("7. express.json + urlencoded", "10 KB body cap to defeat oversized-payload DoS."),
    ("8. mongoSanitize", "Strips $ and . from req.body / query / params — blocks NoSQL injection."),
    ("9. trust proxy = 1", "Honour X-Forwarded-For from the first proxy hop only — accurate IPs for rate limiting."),
    ("10. issueCsrfToken + verifyCsrfToken", "Double-submit cookie CSRF; bearer-auth requests are exempt."),
    ("11. /api routes", "All API routes mounted here."),
    ("12. SPA fallback", "Serves index.html with __CSP_NONCE__ replaced per request."),
    ("13. notFoundHandler", "Generic 404 — never echoes the path."),
    ("14. globalErrorHandler", "Last middleware. Logs internally; returns generic messages to clients (no stack traces)."),
]
pipe_data = [["Step", "Why it's there"]] + [list(r) for r in pipeline]
pt = Table(pipe_data, colWidths=[60 * mm, 114 * mm])
pt.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("FONTNAME", (0, 1), (0, -1), "Courier"),
    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
]))
story.append(pt)
story.append(Spacer(1, 4))

story.append(H2("Pipeline files"))

story.append(file_block(
    "backend/src/middleware/securityHeaders.ts",
    "Helmet configuration — emits the full set of security response headers.",
    [
        "<b>Content-Security-Policy</b> with per-request nonces; <code>useDefaults: false</code> so we don't emit <code>upgrade-insecure-requests</code> (would break plain-http LAN access).",
        "<b>HSTS</b>: max-age 1 year, includeSubDomains. Browsers ignore HSTS over plain http (RFC 6797 §8.1) so this is safe everywhere.",
        "<b>frameguard: deny</b> — legacy X-Frame-Options for old browsers; modern browsers honour <code>frame-ancestors 'none'</code> from the CSP.",
        "<b>noSniff</b>, <b>referrerPolicy</b>, <b>hidePoweredBy</b>, <b>crossOriginOpenerPolicy</b>, <b>crossOriginResourcePolicy</b>.",
        "<b>xssFilter: false</b> — modern browsers ignore this; setting 0 avoids legacy bypass vectors.",
    ],
))

story.append(file_block(
    "backend/src/middleware/cspNonce.ts",
    "Generates 16 random bytes per request and puts them into res.locals.cspNonce. Helmet's CSP directive functions read this value when serialising the header, so every response gets a unique nonce.",
    [
        "Runs BEFORE helmet so the nonce is available when the CSP header is built.",
        "The same nonce is also substituted into the SPA's <code>index.html</code> placeholder so the inline webpack-nonce bootstrap script is accepted.",
    ],
))

story.append(file_block(
    "backend/src/middleware/serverHeader.ts",
    "Defense-in-depth removal of Server and X-Powered-By headers on every response.",
    [
        "Calls <code>res.removeHeader()</code> at middleware time.",
        "Wraps <code>res.writeHead</code> so any later handler that sets these headers gets them stripped right before serialisation.",
        "Belt-and-braces with <code>app.disable('x-powered-by')</code> in app.ts.",
    ],
))

story.append(file_block(
    "backend/src/middleware/csrfProtection.ts",
    "Double-submit cookie CSRF protection for cookie-authenticated requests.",
    [
        "<b>issueCsrfToken</b>: if no XSRF-TOKEN cookie, mints a 32-byte hex token, sets it as a non-httpOnly, SameSite=Strict cookie. JS reads it and echoes it back as the X-XSRF-TOKEN header.",
        "<b>verifyCsrfToken</b>: on POST/PUT/PATCH/DELETE, requires header == cookie (timing-safe compare). Mismatch → 403.",
        "GET/HEAD/OPTIONS and <code>/api/health</code> are exempt.",
        "Bearer-token requests are exempt — bearer auth is structurally CSRF-immune (browsers don't attach Authorization on cross-site requests).",
        "Non-secret token: not session-bearing, only purpose is that an attacker site can't read it (SameSite=Strict + CORS prevent that).",
    ],
))

story.append(file_block(
    "backend/src/middleware/corsMiddleware.ts &amp; CORS_OPTIONS in security.ts",
    "Whitelist-based CORS. Wildcards are not permitted — every origin must match an explicit string or one of a small set of tunnel hostname regexes.",
    [
        "Allowed: exact origins from <code>CORS_ORIGINS</code> env var.",
        "Allowed (regex): <code>*.trycloudflare.com</code>, <code>*.ngrok-free.app</code>, <code>*.ngrok.io</code>, <code>*.loca.lt</code>, <code>*.serveo.net</code>, <code>*.serveousercontent.com</code>.",
        "Allowed only in non-production: private/loopback ranges so devs can test from a phone on the same Wi-Fi.",
        "<code>credentials: true</code> + explicit origins — required for cookie auth.",
        "Allowed headers: Content-Type, Authorization, X-CSRF-Token, X-XSRF-TOKEN, X-Requested-With.",
    ],
))

story.append(file_block(
    "backend/src/middleware/authMiddleware.ts",
    "JWT verification on protected routes.",
    [
        "<b>verifyToken</b>: reads token from Authorization: Bearer header first, then the access_token httpOnly cookie. Verifies signature + issuer + audience + algorithm + expiry.",
        "Re-checks the user in the DB on every request — catches deleted / deactivated accounts even if the token is still cryptographically valid.",
        "Uses the <i>DB</i> role (not the role baked into the token) so role changes take effect immediately.",
        "Returns 401 with a generic message on any failure; logs the failure name at debug level.",
        "<b>optionalAuth</b>: same flow but never blocks — used for endpoints that work both authed and unauthed.",
    ],
))

story.append(file_block(
    "backend/src/middleware/roleMiddleware.ts",
    "RBAC enforcement factory.",
    [
        "<code>requireRole('admin')</code> / <code>requireRole('manager','admin')</code> — explicit allow-list.",
        "Default-deny: any role not listed gets 403.",
        "Unauthorised attempts are written to the audit log (action UNAUTHORIZED_ACCESS, severity warning).",
        "Convenience wrappers <code>requireAdmin</code>, <code>requireManager</code>, <code>requireAnyRole</code>.",
    ],
))

story.append(file_block(
    "backend/src/middleware/rateLimiter.ts",
    "express-rate-limit instances tuned per endpoint category. Every breach is audit-logged.",
    [
        "<b>loginRateLimiter</b> — 5 / 15 min, keyed by IP. Brute-force defence.",
        "<b>apiRateLimiter</b> — 100 / min, keyed by userId (falls back to IP).",
        "<b>unauthRateLimiter</b> — 50 / min, keyed by IP. Anti-scraping.",
        "<b>messageRateLimiter</b> — 10 / min per user. Anti-spam in chat rooms.",
        "<b>readRateLimiter</b> — 500 / min per user. Polling guardrail.",
        "<b>passwordResetRateLimiter</b> — 3 / hour, keyed by IP. Stops email enumeration / mailer abuse.",
    ],
))

story.append(file_block(
    "backend/src/middleware/validationMiddleware.ts",
    "Runs express-validator chains and returns structured 400 responses with field-level messages so the client can show form feedback.",
    [
        "Validations run in parallel for speed.",
        "Field error messages are specific (e.g. &quot;Username is required&quot;) — login errors stay generic to prevent enumeration; validation errors do not.",
    ],
))

story.append(file_block(
    "backend/src/middleware/errorHandler.ts",
    "Last middleware in the chain. Catches all next(err) calls and returns generic messages so internals never leak.",
    [
        "Always logs <code>err.message</code>, <code>err.name</code>, <code>err.stack</code>, <code>req.path</code>, <code>req.user.userId</code> to winston for ops.",
        "Never sends stack traces, error names, or driver-specific text in the response.",
        "Maps Mongoose ValidationError, CastError, duplicate-key (11000), JWT errors, and PayloadTooLarge to safe canned messages.",
        "Falls through to a generic 500 with <code>SERVER_ERRORS.INTERNAL</code> message.",
    ],
))

# ============================================================
# 4. Crypto / hashing utilities
# ============================================================
story.append(PageBreak())
story.append(H1("4. Crypto, hashing, tokens"))

story.append(file_block(
    "backend/src/utils/encryption.ts",
    "Low-level AES-256-GCM authenticated encryption used for emails and chat messages at rest.",
    [
        "<code>encrypt(plaintext)</code>: random 16-byte IV per call, returns <code>iv:authTag:ciphertext</code> base64 string.",
        "<code>decrypt(text)</code>: reconstructs IV + auth tag + ciphertext, sets the auth tag, decrypts. Tampering → throws (auth tag mismatch).",
        "Generic error message thrown on failure — never leaks driver text.",
        "<code>generateSecureToken(bytes)</code> for password-reset tokens; <code>hashToken()</code> SHA-256 for DB storage.",
        "<code>isEncrypted()</code> guards against double-encryption by sniffing the format.",
    ],
))

story.append(file_block(
    "backend/src/utils/passwordUtils.ts",
    "All password handling: hashing, comparison, strength checks, and reuse history.",
    [
        "<code>hashPassword</code> — bcrypt at <b>12 rounds</b>; rejects empty input or input over 72 bytes (bcrypt silently truncates beyond that).",
        "<code>comparePassword</code> — bcrypt's timing-safe compare; returns false on error rather than throwing (no oracle).",
        "<code>validatePasswordStrength</code> — enforces PASSWORD_POLICY: length, upper/lower/digit/special, no all-same-character passwords; returns the full list of violated rules.",
        "<code>generateResetToken</code> — 32 random bytes; returns the raw token (for the email link) and its SHA-256 hash (for DB storage). Raw token is never persisted.",
        "<code>checkPasswordHistory</code> — bcrypt-compares the candidate against each of the user's last 5 hashes; blocks reuse.",
    ],
))

story.append(file_block(
    "backend/src/utils/tokenUtils.ts",
    "JWT sign and verify for access / refresh tokens.",
    [
        "<code>generateAccessToken(userId, role)</code> — type:'access', signed with JWT_ACCESS_SECRET, issuer/audience set.",
        "<code>generateRefreshToken(userId, role)</code> — type:'refresh', signed with the separate JWT_REFRESH_SECRET.",
        "<code>verifyAccessToken</code> / <code>verifyRefreshToken</code> — verify signature, expiry, issuer, audience, algorithm (HS256 only). Also assert the token-type field matches so an access token can't be replayed as a refresh token, and vice-versa.",
        "<code>extractBearerToken</code> — strict <code>Bearer &lt;value&gt;</code> parser; returns null on anything malformed.",
    ],
))

story.append(file_block(
    "backend/src/utils/sanitizers.ts",
    "Input sanitisation — defence in depth alongside validation.",
    [
        "<code>sanitizeString</code> — strips ALL HTML tags and attributes (whitelist = empty), removes null bytes, normalises line endings, trims.",
        "<code>sanitizeObject</code> — recursive variant for whole request bodies; depth-capped at 5 to defeat deeply-nested DoS.",
        "<code>sanitizeHtml</code> — narrow whitelist (b, i, em, strong, u, br); strips <code>javascript:</code> / <code>data:</code> URLs from any href/src.",
        "<code>escapeRegex</code> — escapes regex metacharacters to safely build MongoDB <code>$regex</code> queries from user input.",
    ],
))

# ============================================================
# 5. Services
# ============================================================
story.append(PageBreak())
story.append(H1("5. Auth, sessions, audit services"))

story.append(file_block(
    "backend/src/services/authService.ts",
    "Business logic for register / login / logout / forgotPassword / resetPassword / changePassword / refresh.",
    [
        "<b>register</b>: validates password strength, checks username + email uniqueness, AES-encrypts the email, bcrypt-hashes the password, creates the user as 'employee' (admin assigns higher roles separately), issues a token pair, audit-logs the registration.",
        "<b>login</b>: case-insensitive username lookup; checks isActive, isLockedOut, then bcrypt password. Increments failed counter on bad password — at 5 failures locks for 30 min; the same generic message is returned in every failure case so attackers can't tell &quot;wrong password&quot; from &quot;account locked&quot; from &quot;no such user&quot;.",
        "<b>forgotPassword</b>: <i>always</i> returns success (with a 500 ms delay) regardless of whether the email exists — prevents account enumeration.",
        "<b>resetPassword</b>: validates the SHA-256-hashed token, enforces password strength + history, hashes the new password, invalidates the reset token, and revokes <i>all</i> active sessions so every device has to re-login.",
        "<b>changePassword</b>: requires the current password (re-auth), enforces same checks, revokes all sessions.",
        "<b>refreshAuthTokens</b>: delegates to tokenService for rotation; audit-logs TOKEN_REFRESH on success.",
    ],
))

story.append(file_block(
    "backend/src/services/tokenService.ts",
    "Refresh-token lifecycle with rotation and revocation.",
    [
        "<b>createTokenPair</b>: issues access + refresh JWTs, stores only the SHA-256 hash of the refresh token in the Sessions collection along with IP + UA + expiry.",
        "<b>refreshTokens</b>: verifies JWT, looks up the session by hash, revokes it, then issues a fresh pair (rotation). Limits the window if a refresh token is stolen.",
        "<b>revokeToken</b>: marks a single session revoked (logout).",
        "<b>revokeAllUserTokens</b>: nukes every session for a user (called on password change, role change, admin force-logout).",
    ],
))

story.append(file_block(
    "backend/src/services/auditService.ts",
    "Append-only audit log writes — every auth event, role change, admin action, and security violation lands here.",
    [
        "<code>createLog</code> never throws — failures are logged via winston but must not break the request flow (e.g. a login still completes if audit DB is down).",
        "Auto-assigns severity from ACTION_SEVERITY_MAP (LOGIN_FAILURE → warning, ACCOUNT_LOCKED → critical, ROLE_CHANGE → critical, etc.).",
        "Captures IP via X-Forwarded-For first hop (after trust proxy = 1) and a 500-char-clamped User-Agent.",
        "<code>getLogs</code>, <code>exportLogsAsCsv</code>, <code>exportLogsAsJson</code> for the admin audit screen — paginated; CSV export quotes / escapes fields.",
        "No update / delete operations exist — audit entries are immutable by design.",
    ],
))

story.append(file_block(
    "backend/src/services/encryptionService.ts",
    "Higher-level wrapper around utils/encryption.ts for the two domains that store ciphertext.",
    [
        "<code>encryptMessage</code> / <code>decryptMessage</code> — chat message content; metadata (sender, room, timestamp) stays plaintext for indexing.",
        "<code>encryptEmail</code> / <code>decryptEmail</code> — emails are PII; storing them encrypted limits exposure on a DB compromise.",
        "<code>safeDecryptMessage</code> — returns <code>[message unavailable]</code> instead of crashing list views when one row is corrupt.",
    ],
))

# ============================================================
# 6. Models
# ============================================================
story.append(PageBreak())
story.append(H1("6. Data model security"))

story.append(file_block(
    "backend/src/models/User.ts",
    "Mongoose schema and instance methods for users — the source of truth for identity.",
    [
        "<b>email</b> stored as the AES-256-GCM <code>iv:authTag:cipher</code> blob (encrypted at rest).",
        "<b>passwordHash</b> field has <code>select: false</code> — never returned by default queries; callers must explicitly opt in.",
        "<b>passwordHistory</b> array (also <code>select: false</code>): last 5 bcrypt hashes; pre-save hook trims older entries.",
        "<b>isActive</b> for soft-deactivation.",
        "<b>failedLoginAttempts</b> + <b>isLocked</b> + <b>lockoutExpires</b>: incrementFailedLogin() locks after 5; isLockedOut() auto-clears expired locks.",
        "<code>toJSON</code> transform strips passwordHash, passwordHistory, __v from any serialised response.",
        "<code>findByUsername</code>: case-insensitive exact match using regex with metacharacters escaped.",
    ],
))

story.append(file_block(
    "backend/src/models/Session.ts, PasswordReset.ts, AuditLog.ts",
    "Supporting collections for session tracking, single-use reset tokens, and append-only audit history.",
    [
        "<b>Session</b> — only stores the SHA-256 hash of the refresh token; raw token never touches the DB.",
        "<b>PasswordReset</b> — stores token hash + expiry; <code>findValidToken</code> matches hashed tokens within TTL; <code>invalidateAllForUser</code> burns old tokens after a successful reset.",
        "<b>AuditLog</b> — write-only from the application's perspective; queried via <code>findByFilters(filters, page, limit)</code>.",
    ],
))

# ============================================================
# 7. Sockets
# ============================================================
story.append(H1("7. Real-time (Socket.io)"))

story.append(file_block(
    "backend/src/websocket/socketAuth.ts",
    "Socket-level JWT authentication — sockets need the same identity guarantees as HTTP.",
    [
        "Token sourced from <code>handshake.auth.token</code> first, then <code>handshake.query.token</code>, finally the <code>access_token</code> cookie in the handshake headers.",
        "Same verifyAccessToken call as HTTP — issuer/audience/algorithm/expiry checked.",
        "Re-checks the user in the DB; rejects with &quot;Authentication failed&quot; if the account is gone or deactivated.",
        "Attaches userId, role, username to <code>socket.data</code> for downstream event handlers.",
        "Generic error strings only — no detail leaks across the socket boundary.",
    ],
))

# ============================================================
# 8. Frontend
# ============================================================
story.append(H1("8. Frontend security touchpoints"))

story.append(file_block(
    "frontend/public/index.html",
    "SPA shell. Carries no security META tags (ZAP flags meta-delivered headers as non-spec); everything authoritative comes via HTTP headers from Express.",
    [
        "Single inline <code>&lt;script nonce=&quot;__CSP_NONCE__&quot;&gt;</code> that sets <code>window.__webpack_nonce__</code> so any dynamically-injected webpack chunks carry the per-request nonce.",
        "Server replaces the <code>__CSP_NONCE__</code> placeholder on every HTML response.",
        "<code>&lt;noscript&gt;</code> message uses inline <code>style=&quot;&quot;</code> attrs only — covered by the narrow <code>style-src-attr 'unsafe-inline'</code>, which cannot be used to execute script.",
    ],
))

story.append(file_block(
    "frontend/src/services/api.ts",
    "Central axios instance.",
    [
        "<code>withCredentials: true</code> — cookies (access/refresh/XSRF) ride every request.",
        "<code>xsrfCookieName: 'XSRF-TOKEN'</code> + <code>xsrfHeaderName: 'X-XSRF-TOKEN'</code> — axios reads the cookie and auto-attaches the header to satisfy double-submit CSRF.",
        "Authorization Bearer injector pulls the access token from localStorage.",
        "Response interceptor: on 401, attempts a one-shot refresh-and-retry via /api/auth/refresh; queues concurrent requests during refresh; on refresh failure, clears state and redirects to /login.",
        "Wraps network errors (no response) in a single human-readable message — internal axios error structure never reaches the UI.",
    ],
))

# ============================================================
# 9. Container / deployment
# ============================================================
story.append(H1("9. Container &amp; deploy hygiene"))

story.append(file_block(
    "Dockerfile",
    "Multi-stage build (frontend-build → backend-build → alpine runtime).",
    [
        "Frontend built with <code>INLINE_RUNTIME_CHUNK=false</code> so there's no inline runtime &lt;script&gt; (that would need a nonce CRA can't provide at build time).",
        "<code>GENERATE_SOURCEMAP=false</code> — no <code>.map</code> files in the production image (kills the ZAP &quot;Source Code Disclosure&quot; alert).",
        "Production stage runs <code>npm ci --omit=dev</code> — no devDependencies in the final image.",
        "Drops privileges: creates the <code>app</code> user/group with <code>addgroup -S app &amp;&amp; adduser -S -G app app</code>, <code>chown</code>s /app, then <code>USER app</code>.",
        "HEALTHCHECK against <code>/api/health</code> via wget every 30 s.",
    ],
))

story.append(file_block(
    "docker-compose.yml",
    "Single-image deployment plus an optional serveo SSH tunnel sidecar (--profile tunnel) for public URL exposure.",
    [
        "<code>env_file: ./backend/.env</code> — secrets are runtime-injected, never baked into the image, so rotating keys only needs <code>docker compose up -d</code>.",
        "<code>restart: unless-stopped</code>; healthcheck on the API.",
        "Tunnel sidecar runs <code>ssh -R 80:app:5000 serveo.net</code> in a reconnect loop — disabled by default.",
    ],
))

story.append(file_block(
    ".dockerignore",
    "Keeps secrets and bulk out of the build context.",
    [
        "Excludes <code>**/.env</code> and <code>**/.env.*</code> (only <code>.env.example</code> is allowed in).",
        "Excludes <code>node_modules</code>, <code>dist</code>, <code>build</code>, <code>coverage</code>, logs, IDE noise, .git, docs.",
    ],
))

# ============================================================
# 10. Cross-cutting threats addressed
# ============================================================
story.append(PageBreak())
story.append(H1("10. Threat → defence cross-reference"))

threats = [
    ("Credential brute-force", "loginRateLimiter (5/15 min) + LOCKOUT_POLICY (5 fails = 30 min lock) + bcrypt(12) timing"),
    ("Account enumeration", "Generic error messages on login + forgotPassword always returns success with 500ms delay"),
    ("XSS", "Helmet CSP with nonce + style-src-attr scoped + sanitizeString/sanitizeObject + React's default escaping"),
    ("CSRF", "Double-submit XSRF-TOKEN cookie (SameSite=Strict) + X-XSRF-TOKEN header verified server-side"),
    ("Clickjacking", "frame-ancestors 'none' + X-Frame-Options: DENY"),
    ("Click-protocol/JS URL abuse", "sanitizeHtml strips javascript: / data: protocols from href/src"),
    ("MIME sniffing", "X-Content-Type-Options: nosniff"),
    ("Information disclosure (server)", "Hide X-Powered-By + strip Server header + writeHead patch"),
    ("Information disclosure (errors)", "globalErrorHandler returns generic messages; full detail logged server-side only"),
    ("Information disclosure (build)", "GENERATE_SOURCEMAP=false; comments stripped by terser; .dockerignore excludes secrets"),
    ("NoSQL injection", "express-mongo-sanitize strips $ and . from inputs; escapeRegex() on user-supplied regex queries"),
    ("Oversized payload DoS", "express.json({ limit: '10kb' }); sanitizeObject depth-cap = 5"),
    ("Password reuse", "passwordHistory (last 5 bcrypt hashes); changePassword + resetPassword check before saving"),
    ("Session hijack via stolen refresh token", "Token rotation: each refresh revokes the old session and issues a fresh pair"),
    ("Stale JWT after deactivation", "Auth middleware re-fetches the user on every request; uses DB role, not token role"),
    ("Email PII leakage", "Email stored AES-256-GCM encrypted at rest; only decrypted in-process for owner views"),
    ("Tunnel host injection", "CORS allow-list uses regex hostname patterns + private-LAN allowed only in non-production"),
    ("Audit log tampering", "AuditLog model exposes no update/delete; failures don't block the request"),
    ("MITM downgrade", "HSTS max-age=31536000; includeSubDomains (browsers ignore over plain http)"),
    ("Source-code disclosure", "GENERATE_SOURCEMAP=false strips .map files from production"),
]
threat_data = [["Threat", "Where it's mitigated"]] + [list(r) for r in threats]
tt = Table(threat_data, colWidths=[60 * mm, 114 * mm])
tt.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
]))
story.append(tt)

story.append(Spacer(1, 8))
story.append(P(
    "<i>End of report. Generated from a static read of the codebase as of "
    "the most recent build. For day-to-day reference, the canonical source "
    "is the code itself — every file referenced here carries a top-of-file "
    "doc comment summarising its security role.</i>"
))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(18 * mm, 10 * mm, "Shield-Chat Security Map")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f"OK: {OUT} ({OUT.stat().st_size:,} bytes)")
